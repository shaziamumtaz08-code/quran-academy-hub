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

/** Maps an event trigger to the matching column in notification_preferences. */
const PREFERENCE_COLUMN: Record<string, string> = {
  class_reminder: "class_reminders",
  fee_reminder: "fee_reminders",
  attendance_absent: "attendance_alerts",
  announcement: "announcements",
  new_message: "messages",
};

/**
 * Returns the set of recipient ids that have opted OUT of this trigger.
 * Missing rows mean "opted in" (defaults are on).
 */
async function loadOptOuts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  eventTrigger: string,
  ids: string[],
): Promise<Set<string>> {
  const column = PREFERENCE_COLUMN[eventTrigger];
  if (!column || ids.length === 0) return new Set();
  const { data } = await supabase
    .from("notification_preferences")
    .select(`user_id, ${column}`)
    .in("user_id", ids);
  const out = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (row[column] === false) out.add(row.user_id);
  }
  return out;
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
  const trigger = String(template.event_trigger || "");
  const optedOut = await loadOptOuts(
    supabase,
    trigger,
    recipients.map((r) => r.profile_id),
  );

  for (const recipient of recipients) {
    try {
      if (optedOut.has(recipient.profile_id)) continue;

      const vars = { ...basePayload, ...(recipient.vars || {}) };
      const rendered = renderTemplate(template.template_text || "", vars);

      // Always mirror into the in-app inbox so the bell works even when the
      // user has no device token (desktop without permission, iOS not installed).
      await supabase.from("notification_queue").insert({
        recipient_id: recipient.profile_id,
        recipient_type: "user",
        notification_type: trigger || "push",
        title,
        message: rendered,
        metadata: vars,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

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
