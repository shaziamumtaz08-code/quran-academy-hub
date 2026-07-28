// Shared push dispatch used by scheduled reminder functions.
// Mirrors the queuing + FCM delivery behaviour of the send-notification
// 'push' branch, but callable from a service-role (cron) context.

import { getServiceAccount, getAccessToken, sendToToken } from "./fcm.ts";

export interface PushSummary {
  recipients_found: number;
  tokens_found: number;
  sent: number;
  failed: number;
  skipped_no_token: number;
  template_missing: boolean;
  notes: string[];
}

export function emptySummary(): PushSummary {
  return {
    recipients_found: 0,
    tokens_found: 0,
    sent: 0,
    failed: 0,
    skipped_no_token: 0,
    template_missing: false,
    notes: [],
  };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value ?? "");
  }
  return result;
}

// deno-lint-ignore no-explicit-any
export async function loadPushTemplate(supabase: any, eventTrigger: string) {
  const { data } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("event_trigger", eventTrigger)
    .eq("is_active", true)
    .eq("channel", "push")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export interface PushRecipient {
  profile_id: string;
  vars?: Record<string, string>;
}

/**
 * Queues + delivers a push notification to each recipient that has at least
 * one registered token. Never throws for a single recipient — failures are
 * counted in the summary.
 */
export async function dispatchPush(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  template: any,
  recipients: PushRecipient[],
  basePayload: Record<string, string>,
  summary: PushSummary,
): Promise<PushSummary> {
  summary.recipients_found += recipients.length;
  if (recipients.length === 0) return summary;

  const sa = getServiceAccount();
  let accessToken: string | null = null;
  if (sa) {
    try {
      accessToken = await getAccessToken(sa);
    } catch (err) {
      summary.notes.push(
        `FCM auth failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  } else {
    summary.notes.push("FCM_SERVICE_ACCOUNT_JSON secret is not set or invalid");
  }

  const title = template.name || "Notification";

  for (const recipient of recipients) {
    try {
      const vars = { ...basePayload, ...(recipient.vars || {}) };
      const rendered = renderTemplate(template.template_text || "", vars);

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("id, token")
        .eq("user_id", recipient.profile_id);

      if (!tokens?.length) {
        summary.skipped_no_token++;
        continue;
      }
      summary.tokens_found += tokens.length;

      const { data: event, error: insErr } = await supabase
        .from("notification_events")
        .insert({
          template_id: template.id,
          recipient_id: recipient.profile_id,
          channel: "push",
          payload: vars,
          rendered_text: rendered,
          status: "queued",
        })
        .select()
        .single();

      if (insErr || !event) {
        summary.failed++;
        summary.notes.push(`queue failed: ${insErr?.message || "unknown"}`);
        continue;
      }

      if (!sa || !accessToken) {
        await supabase
          .from("notification_events")
          .update({
            status: "failed",
            error_message: "FCM not configured",
          })
          .eq("id", event.id);
        summary.failed++;
        continue;
      }

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
        summary.sent++;
      } else {
        await supabase
          .from("notification_events")
          .update({
            status: "failed",
            error_message: errors.join(" | ").slice(0, 1000),
          })
          .eq("id", event.id);
        summary.failed++;
      }
    } catch (err) {
      summary.failed++;
      summary.notes.push(
        `recipient ${recipient.profile_id}: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  return summary;
}
