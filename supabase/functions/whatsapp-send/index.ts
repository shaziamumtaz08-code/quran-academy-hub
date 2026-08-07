import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT (or allow service-role calls from internal cron functions)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isService = token === serviceKey;
    let senderId: string | null = null;

    if (!isService) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      senderId = user.id;
    }

    const body = await req.json();
    const { message_text, template_name, attachment_url, attachment_type, phone, name } = body;
    let contact_id: string | undefined = body.contact_id;

    if ((!contact_id && !phone) || (!message_text && !template_name)) {
      return new Response(JSON.stringify({ error: "contact_id or phone, plus message_text or template_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve (or create, for service calls) the contact
    let contact: { phone: string; name: string | null } | null = null;

    if (contact_id) {
      const { data } = await supabase
        .from("whatsapp_contacts")
        .select("phone, name")
        .eq("id", contact_id)
        .single();
      contact = data;
    } else if (isService && phone) {
      const { data: existing } = await supabase
        .from("whatsapp_contacts")
        .select("id, phone, name")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) {
        contact_id = existing.id;
        contact = { phone: existing.phone, name: existing.name };
      } else {
        const { data: created } = await supabase
          .from("whatsapp_contacts")
          .insert({ phone, name: name ?? null })
          .select("id, phone, name")
          .single();
        if (created) {
          contact_id = created.id;
          contact = { phone: created.phone, name: created.name };
        }
      }
    }

    if (!contact || !contact_id) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsChimp config from system_integrations
    const { data: waConfig } = await supabase
      .from("system_integrations")
      .select("config")
      .eq("service_name", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .single();

    let deliveryStatus = "queued";
    let waMessageId: string | null = null;

    if (waConfig?.config) {
      const config = waConfig.config as Record<string, string>;
      const apiUrl = config.api_url;
      const apiKey = config.api_key;

      if (apiUrl && apiKey) {
        try {
          const waPayload: Record<string, unknown> = {
            phone: contact.phone,
            message: message_text || "",
          };

          if (template_name) {
            waPayload.template = template_name;
          }
          if (attachment_url) {
            waPayload.media_url = attachment_url;
            waPayload.media_type = attachment_type || "document";
          }

          const waResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(waPayload),
          });

          if (waResponse.ok) {
            const result = await waResponse.json();
            deliveryStatus = "sent";
            waMessageId = result.message_id || null;
          } else {
            const errText = await waResponse.text();
            console.error("WhatsChimp send error:", errText);
            deliveryStatus = "failed";
          }
        } catch (sendErr: unknown) {
          console.error("WhatsChimp send exception:", sendErr);
          deliveryStatus = "failed";
        }
      }
    }

    // Store outbound message
    const { data: msg, error: insertErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        contact_id,
        direction: "outbound",
        message_text: message_text || null,
        attachment_url: attachment_url || null,
        attachment_type: attachment_type || null,
        delivery_status: deliveryStatus,
        wa_message_id: waMessageId,
        template_name: template_name || null,
        sent_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update contact last_message_at
    await supabase
      .from("whatsapp_contacts")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", contact_id);

    return new Response(
      JSON.stringify({ success: true, message: msg, delivery_status: deliveryStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-send error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
