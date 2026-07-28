import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireRole } from "../_shared/auth.ts";
import {
  dispatchPush,
  emptySummary,
  loadPushTemplate,
  type PushRecipient,
} from "../_shared/pushDispatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Academy default timezone — mirrors DEFAULT_ACADEMY_TZ in src/hooks/useAcademyTimezone.ts */
const DEFAULT_ACADEMY_TZ = "Asia/Karachi";

/** Lowercase weekday name in the given timezone (same convention as schedules.day_of_week). */
function zonedDayName(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    .format(date)
    .toLowerCase();
}

function minutesToLabel(time: string): string {
  const [hRaw, mRaw] = (time || "00:00").split(":");
  const h = Number(hRaw) || 0;
  const m = Number(mRaw) || 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Cron calls arrive with the service-role key; humans must be admins. */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const summary = emptySummary();

  try {
    const auth = await authorize(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = auth.adminClient;

    const tz = DEFAULT_ACADEMY_TZ;
    const dayName = zonedDayName(tz);

    // Today's active schedule slots (read-only; same source as Live operations).
    const { data: schedules, error: schedErr } = await supabase
      .from("schedules")
      .select("id, assignment_id, teacher_local_time, duration_minutes")
      .eq("day_of_week", dayName)
      .eq("is_active", true);
    if (schedErr) throw schedErr;

    const assignmentIds = [
      ...new Set((schedules ?? []).map((s: { assignment_id: string }) => s.assignment_id).filter(Boolean)),
    ];

    if (assignmentIds.length === 0) {
      console.log("push-class-reminders summary", { day: dayName, ...summary });
      return new Response(JSON.stringify({ success: true, day: dayName, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assignments } = await supabase
      .from("student_teacher_assignments")
      .select("id, teacher_id, student_id, status, subject:subjects(name)")
      .in("id", assignmentIds)
      .eq("status", "active");

    // deno-lint-ignore no-explicit-any
    const assignMap = new Map((assignments ?? []).map((a: any) => [a.id, a]));

    const studentIds = [
      // deno-lint-ignore no-explicit-any
      ...new Set((assignments ?? []).map((a: any) => a.student_id).filter(Boolean)),
    ] as string[];

    // Parents of those students
    const { data: links } = studentIds.length
      ? await supabase
        .from("student_parent_links")
        .select("student_id, parent_id")
        .in("student_id", studentIds)
      : { data: [] };
    const parentsByStudent = new Map<string, string[]>();
    // deno-lint-ignore no-explicit-any
    for (const l of (links ?? []) as any[]) {
      if (!l.parent_id) continue;
      const arr = parentsByStudent.get(l.student_id) ?? [];
      arr.push(l.parent_id);
      parentsByStudent.set(l.student_id, arr);
    }

    // Names for template vars
    const profileIds = [
      ...new Set(
        // deno-lint-ignore no-explicit-any
        (assignments ?? []).flatMap((a: any) => [a.teacher_id, a.student_id]).filter(Boolean),
      ),
    ] as string[];
    const { data: profiles } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] };
    // deno-lint-ignore no-explicit-any
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const template = await loadPushTemplate(supabase, "class_reminder");
    if (!template) {
      summary.template_missing = true;
      summary.notes.push("No active push template for trigger: class_reminder");
      console.log("push-class-reminders summary", { day: dayName, ...summary });
      return new Response(JSON.stringify({ success: true, day: dayName, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    for (const s of (schedules ?? []) as any[]) {
      // deno-lint-ignore no-explicit-any
      const a: any = assignMap.get(s.assignment_id);
      if (!a) continue;

      const startLabel = minutesToLabel(s.teacher_local_time);
      const vars: Record<string, string> = {
        student_name: String(nameMap.get(a.student_id) ?? "Student"),
        teacher_name: String(nameMap.get(a.teacher_id) ?? "Teacher"),
        subject_name: a.subject?.name ?? "Class",
        class_time: startLabel,
        duration_minutes: String(s.duration_minutes ?? 30),
      };

      const recipients: PushRecipient[] = [];
      if (a.student_id) recipients.push({ profile_id: a.student_id, vars });
      if (a.teacher_id) recipients.push({ profile_id: a.teacher_id, vars });
      for (const parentId of parentsByStudent.get(a.student_id) ?? []) {
        recipients.push({ profile_id: parentId, vars });
      }

      await dispatchPush(supabase, template, recipients, vars, summary);
    }

    console.log("push-class-reminders summary", { day: dayName, ...summary });
    return new Response(JSON.stringify({ success: true, day: dayName, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("push-class-reminders error:", message, summary);
    return new Response(JSON.stringify({ error: message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
