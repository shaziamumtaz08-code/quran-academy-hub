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

    const payload = await req.json();

    // WhatsChimp webhook format — adapt based on their actual API docs
    // Common fields: message_id, from, to, text, media_url, media_type, timestamp, status
    const {
      event_type,
      message_id,
      from: senderPhone,
      to: recipientPhone,
      text,
      media_url,
      media_type,
      timestamp,
      status,
      contact_name,
    } = payload;

    // Handle delivery status updates
    if (event_type === "status_update" && message_id && status) {
      const statusMap: Record<string, string> = {
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
      };
      const mappedStatus = statusMap[status] || status;

      await supabase
        .from("whatsapp_messages")
        .update({ delivery_status: mappedStatus })
        .eq("wa_message_id", message_id);

      return new Response(JSON.stringify({ ok: true, type: "status_update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle incoming message
    if (event_type === "message" || !event_type) {
      const phone = senderPhone?.replace(/[^+\d]/g, "") || "";
      if (!phone) {
        return new Response(JSON.stringify({ error: "No sender phone" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert contact
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .upsert(
          {
            phone,
            name: contact_name || phone,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        )
        .select("id, profile_id")
        .single();

      if (!contact) {
        return new Response(JSON.stringify({ error: "Failed to upsert contact" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to auto-link profile by phone
      if (!contact.profile_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .limit(1)
          .single();

        if (profile) {
          await supabase
            .from("whatsapp_contacts")
            .update({ profile_id: profile.id })
            .eq("id", contact.id);
        }
      }

      // Insert message
      const { error: msgError } = await supabase.from("whatsapp_messages").insert({
        contact_id: contact.id,
        direction: "inbound",
        message_text: text || null,
        attachment_url: media_url || null,
        attachment_type: media_type || null,
        delivery_status: "delivered",
        wa_message_id: message_id || null,
      });

      if (msgError) {
        console.error("Failed to insert message:", msgError);
        return new Response(JSON.stringify({ error: msgError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Increment unread count
      await supabase.rpc("increment_unread", { _contact_id: contact.id }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from("whatsapp_contacts")
          .update({ unread_count: (contact as any).unread_count + 1 })
          .eq("id", contact.id);
      });

      return new Response(JSON.stringify({ ok: true, type: "message_received" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, type: "ignored" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
