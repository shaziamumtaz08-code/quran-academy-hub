import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Cron calls arrive with the service-role key (or cron secret); humans must be admins. */
async function authorize(req: Request) {
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const cronSecret = Deno.env.get("CRON_PUSH_SECRET") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const isCron = !!cronSecret && cronHeader === cronSecret;
  if (SERVICE_KEY && (isCron || token === SERVICE_KEY)) {
    return { ok: true as const, adminClient: createClient(SUPABASE_URL, SERVICE_KEY) };
  }
  return await requireRole(req, ["super_admin", "admin", "admin_division"]);
}

function render(text: string, vars: Record<string, string>): string {
  let out = text ?? "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v ?? "");
  }
  return out;
}

async function sendWhatsApp(payload: Record<string, unknown>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

/** Resolve WhatsApp recipients (student, else linked parents) for a set of students. */
// deno-lint-ignore no-explicit-any
async function resolveRecipients(supabase: any, studentIds: string[]) {
  if (!studentIds.length) return new Map<string, { phone: string; name: string }[]>();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, phone, archived_at")
    .in("id", studentIds);

  const { data: links } = await supabase
    .from("student_parent_links")
    .select("student_id, parent_id")
    .in("student_id", studentIds);

  const parentIds = [
    // deno-lint-ignore no-explicit-any
    ...new Set(((links ?? []) as any[]).map((l) => l.parent_id).filter(Boolean)),
  ] as string[];

  const { data: parents } = parentIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", parentIds)
    : { data: [] };

  // deno-lint-ignore no-explicit-any
  const parentMap = new Map(((parents ?? []) as any[]).map((p) => [p.id, p]));
  const parentsByStudent = new Map<string, string[]>();
  // deno-lint-ignore no-explicit-any
  for (const l of (links ?? []) as any[]) {
    const arr = parentsByStudent.get(l.student_id) ?? [];
    arr.push(l.parent_id);
    parentsByStudent.set(l.student_id, arr);
  }

  const out = new Map<string, { phone: string; name: string }[]>();
  // deno-lint-ignore no-explicit-any
  for (const s of (students ?? []) as any[]) {
    if (s.archived_at) continue; // never message archived students
    const list: { phone: string; name: string }[] = [];
    if (s.phone) list.push({ phone: s.phone, name: s.full_name ?? "Student" });
    for (const pid of parentsByStudent.get(s.id) ?? []) {
      const p = parentMap.get(pid);
      // deno-lint-ignore no-explicit-any
      if ((p as any)?.phone) list.push({ phone: (p as any).phone, name: (p as any).full_name ?? "Parent" });
    }
    out.set(s.id, list);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const summary = {
    posts_processed: 0,
    posts_sent: 0,
    posts_failed: 0,
    sequences_checked: 0,
    sequence_messages_sent: 0,
    sequence_messages_failed: 0,
    notes: [] as string[],
  };

  try {
    const auth = await authorize(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = auth.adminClient;
    const nowIso = new Date().toISOString();

    // ---------- 1. Promotional posts due for sending ----------
    const { data: posts, error: postErr } = await supabase
      .from("promotional_posts")
      .select("id, course_id, title, content, attachment_url, channels, scheduled_at")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", nowIso);
    if (postErr) throw postErr;

    // deno-lint-ignore no-explicit-any
    for (const post of (posts ?? []) as any[]) {
      summary.posts_processed++;

      const wantsWhatsApp = (post.channels ?? []).includes("whatsapp");
      let failed = 0;

      if (wantsWhatsApp) {
        const { data: enrolls } = await supabase
          .from("course_enrollments")
          .select("student_id, status")
          .eq("course_id", post.course_id);
        const studentIds = [
          // deno-lint-ignore no-explicit-any
          ...new Set(((enrolls ?? []) as any[])
            .filter((e) => !e.status || e.status === "active" || e.status === "enrolled")
            .map((e) => e.student_id)
            .filter(Boolean)),
        ] as string[];

        const recipients = await resolveRecipients(supabase, studentIds);
        const seen = new Set<string>();

        for (const list of recipients.values()) {
          for (const r of list) {
            if (seen.has(r.phone)) continue;
            seen.add(r.phone);
            const res = await sendWhatsApp({
              phone: r.phone,
              name: r.name,
              message_text: render(`*${post.title}*\n\n${post.content}`, { name: r.name }),
              attachment_url: post.attachment_url || undefined,
              attachment_type: post.attachment_url ? "document" : undefined,
            });
            if (!res.ok) {
              failed++;
              console.error(`promotional_post ${post.id} send failed [${res.status}]: ${res.body}`);
            }
          }
        }
      }

      // Mark as sent regardless of channel mix (social/lms are display-only channels).
      const { error: updErr } = await supabase
        .from("promotional_posts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", post.id);
      if (updErr) {
        summary.posts_failed++;
        console.error(`promotional_post ${post.id} status update failed: ${updErr.message}`);
      } else {
        summary.posts_sent++;
      }
      if (failed) summary.posts_failed += 0; // delivery failures logged, post still closed out
    }

    // ---------- 2. Course message sequences ----------
    const { data: seqs, error: seqErr } = await supabase
      .from("course_message_sequences")
      .select("id, course_id, title, body, attachment_url, channels, delay_rule, delay_days")
      .eq("is_enabled", true);
    if (seqErr) throw seqErr;

    const courseIds = [
      // deno-lint-ignore no-explicit-any
      ...new Set(((seqs ?? []) as any[]).map((s) => s.course_id).filter(Boolean)),
    ] as string[];

    const { data: courses } = courseIds.length
      ? await supabase.from("courses").select("id, title, start_date").in("id", courseIds)
      : { data: [] };
    // deno-lint-ignore no-explicit-any
    const courseMap = new Map(((courses ?? []) as any[]).map((c) => [c.id, c]));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // deno-lint-ignore no-explicit-any
    for (const seq of (seqs ?? []) as any[]) {
      summary.sequences_checked++;
      const course = courseMap.get(seq.course_id);
      if (!course?.start_date) continue;

      const start = new Date(`${String(course.start_date).slice(0, 10)}T00:00:00Z`);
      const dueDate = new Date(start);
      const days = Number(seq.delay_days ?? 0);
      if (seq.delay_rule === "before_start") dueDate.setUTCDate(dueDate.getUTCDate() - days);
      else dueDate.setUTCDate(dueDate.getUTCDate() + days); // after_start / on_start(0)

      if (dueDate.getTime() > today.getTime()) continue; // not due yet

      if (!(seq.channels ?? []).includes("whatsapp")) continue;

      const { data: enrolls } = await supabase
        .from("course_enrollments")
        .select("student_id, status")
        .eq("course_id", seq.course_id);
      const studentIds = [
        // deno-lint-ignore no-explicit-any
        ...new Set(((enrolls ?? []) as any[])
          .filter((e) => !e.status || e.status === "active" || e.status === "enrolled")
          .map((e) => e.student_id)
          .filter(Boolean)),
      ] as string[];
      if (!studentIds.length) continue;

      // Skip students who already received this step
      const { data: sent } = await supabase
        .from("course_message_sequence_sends")
        .select("recipient_profile_id")
        .eq("sequence_id", seq.id)
        .in("recipient_profile_id", studentIds);
      // deno-lint-ignore no-explicit-any
      const alreadySent = new Set(((sent ?? []) as any[]).map((r) => r.recipient_profile_id));
      const pending = studentIds.filter((id) => !alreadySent.has(id));
      if (!pending.length) continue;

      const recipients = await resolveRecipients(supabase, pending);

      for (const [studentId, list] of recipients.entries()) {
        if (!list.length) continue;
        let anySent = false;
        const errors: string[] = [];

        for (const r of list) {
          const res = await sendWhatsApp({
            phone: r.phone,
            name: r.name,
            message_text: render(seq.body || seq.title, {
              name: r.name,
              course_name: course.title ?? "",
            }),
            attachment_url: seq.attachment_url || undefined,
            attachment_type: seq.attachment_url ? "document" : undefined,
          });
          if (res.ok) anySent = true;
          else errors.push(`[${res.status}] ${res.body}`.slice(0, 300));
        }

        await supabase.from("course_message_sequence_sends").upsert({
          sequence_id: seq.id,
          course_id: seq.course_id,
          recipient_profile_id: studentId,
          recipient_phone: list[0]?.phone ?? null,
          status: anySent ? "sent" : "failed",
          error_message: anySent ? null : errors.join(" | ").slice(0, 1000),
        }, { onConflict: "sequence_id,recipient_profile_id" });

        if (anySent) summary.sequence_messages_sent++;
        else summary.sequence_messages_failed++;
      }
    }

    console.log("dispatch-marketing-messages summary", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("dispatch-marketing-messages error:", message, summary);
    return new Response(JSON.stringify({ error: message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
