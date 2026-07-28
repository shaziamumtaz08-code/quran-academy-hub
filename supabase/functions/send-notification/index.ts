import { requireRole } from "../_shared/auth.ts";
import { getServiceAccount, getAccessToken, sendToToken } from "./fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await requireRole(req, ["super_admin", "admin", "admin_division", "teacher"]);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = auth.adminClient;

    const { event_trigger, recipients, payload, channel } = await req.json();

    if (!event_trigger || !recipients?.length) {
      return new Response(
        JSON.stringify({ error: "event_trigger and recipients[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find active template for this trigger
    const { data: template } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("event_trigger", event_trigger)
      .eq("is_active", true)
      .eq("channel", channel || "whatsapp")
      .limit(1)
      .single();

    if (!template) {
      return new Response(
        JSON.stringify({ error: `No active template for trigger: ${event_trigger}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; status: string; rendered_text: string }[] = [];

    for (const recipient of recipients) {
      const rendered = renderTemplate(template.template_text, {
        ...payload,
        ...(recipient.vars || {}),
      });

      // Queue the notification event
      const { data: event, error } = await supabase
        .from("notification_events")
        .insert({
          template_id: template.id,
          recipient_id: recipient.profile_id || null,
          recipient_phone: recipient.phone || null,
          recipient_email: recipient.email || null,
          channel: template.channel,
          payload: { ...payload, ...(recipient.vars || {}) },
          rendered_text: rendered,
          status: "queued",
          triggered_by: recipient.triggered_by || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to queue notification:", error);
        continue;
      }

      // For WhatsApp — attempt delivery via system_integrations config
      if (template.channel === "whatsapp") {
        const { data: waConfig } = await supabase
          .from("system_integrations")
          .select("config")
          .eq("service_name", "whatsapp")
          .eq("is_active", true)
          .limit(1)
          .single();

        if (waConfig?.config) {
          const config = waConfig.config as Record<string, string>;
          const apiUrl = config.api_url;
          const apiKey = config.api_key;

          if (apiUrl && apiKey && recipient.phone) {
            try {
              const waResponse = await fetch(apiUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  phone: recipient.phone,
                  message: rendered,
                }),
              });

              if (waResponse.ok) {
                await supabase
                  .from("notification_events")
                  .update({ status: "sent", sent_at: new Date().toISOString() })
                  .eq("id", event.id);
                
                results.push({ id: event.id, status: "sent", rendered_text: rendered });
                continue;
              } else {
                const errText = await waResponse.text();
                await supabase
                  .from("notification_events")
                  .update({ status: "failed", error_message: errText })
                  .eq("id", event.id);
              }
            } catch (waErr: unknown) {
              const msg = waErr instanceof Error ? waErr.message : "Unknown error";
              await supabase
                .from("notification_events")
                .update({ status: "failed", error_message: msg })
                .eq("id", event.id);
            }
          }
        }
      }

      // For Push — deliver via FCM HTTP v1
      if (template.channel === "push") {
        const title = template.subject || template.event_trigger || "Notification";

        if (!recipient.profile_id) {
          await supabase
            .from("notification_events")
            .update({ status: "failed", error_message: "no push tokens registered" })
            .eq("id", event.id);
          results.push({ id: event.id, status: "failed", rendered_text: rendered });
          continue;
        }

        const { data: tokens } = await supabase
          .from("push_tokens")
          .select("id, token")
          .eq("user_id", recipient.profile_id);

        if (!tokens?.length) {
          await supabase
            .from("notification_events")
            .update({ status: "failed", error_message: "no push tokens registered" })
            .eq("id", event.id);
          results.push({ id: event.id, status: "failed", rendered_text: rendered });
          continue;
        }

        const sa = getServiceAccount();
        if (!sa) {
          const msg = "FCM_SERVICE_ACCOUNT_JSON secret is not set or invalid";
          await supabase
            .from("notification_events")
            .update({ status: "failed", error_message: msg })
            .eq("id", event.id);
          results.push({ id: event.id, status: "failed", rendered_text: rendered });
          continue;
        }

        try {
          const accessToken = await getAccessToken(sa);
          let anySent = false;
          const errors: string[] = [];

          for (const t of tokens) {
            const res = await sendToToken(sa, accessToken, t.token, title, rendered, {
              event_trigger: String(template.event_trigger || ""),
            });
            if (res.ok) {
              anySent = true;
            } else {
              errors.push(res.error || "unknown FCM error");
              if (res.stale) {
                await supabase.from("push_tokens").delete().eq("id", t.id);
              }
            }
          }

          if (anySent) {
            await supabase
              .from("notification_events")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", event.id);
            results.push({ id: event.id, status: "sent", rendered_text: rendered });
          } else {
            await supabase
              .from("notification_events")
              .update({ status: "failed", error_message: errors.join(" | ").slice(0, 1000) })
              .eq("id", event.id);
            results.push({ id: event.id, status: "failed", rendered_text: rendered });
          }
        } catch (pushErr: unknown) {
          const msg = pushErr instanceof Error ? pushErr.message : "Unknown push error";
          await supabase
            .from("notification_events")
            .update({ status: "failed", error_message: msg })
            .eq("id", event.id);
          results.push({ id: event.id, status: "failed", rendered_text: rendered });
        }
        continue;
      }

      results.push({
        id: event.id,
        status: event.status,
        rendered_text: rendered,
      });
    }

    return new Response(
      JSON.stringify({ success: true, queued: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-notification error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
