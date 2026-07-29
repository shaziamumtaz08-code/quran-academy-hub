// Auto-generates a parent-facing remark for a report card and self-flags it
// for admin review when marks are low or the wording is sensitive.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SENSITIVE_PATTERNS = [
  "fail", "failing", "failed", "poor", "weak", "lazy", "disappointing", "unacceptable",
  "bad behaviour", "bad behavior", "misbehav", "punish", "worst", "hopeless", "careless",
  "no improvement", "not serious", "disrespect", "absent too", "warning",
];

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Authentication required" });

    const authed = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await authed.auth.getUser(authHeader.slice(7));
    if (uErr || !user) return json(401, { error: "Invalid session" });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles || []).some((r: { role: string }) =>
      ["super_admin", "admin", "teacher", "examiner"].includes(r.role) || String(r.role).startsWith("admin_")
    );
    if (!allowed) return json(403, { error: "Forbidden" });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const examId = String(body?.exam_id ?? "").trim();
    const threshold = Number(body?.threshold ?? 50);
    if (!isUuid(examId)) return json(400, { error: "Invalid exam_id" });

    const { data: exam, error: eErr } = await admin
      .from("exams")
      .select(`
        id, percentage, total_marks, max_total_marks, criteria_values_json, examiner_remarks, exam_date,
        student:profiles!exams_student_id_fkey(full_name),
        template:exam_templates!exams_template_id_fkey(name, subject:subjects(name))
      `)
      .eq("id", examId)
      .single();
    if (eErr || !exam) return json(404, { error: "Report card not found" });

    const criteria = Array.isArray(exam.criteria_values_json) ? exam.criteria_values_json as any[] : [];
    const studentName = (exam as any).student?.full_name ?? "the student";
    const subjectName = (exam as any).template?.subject?.name ?? (exam as any).template?.name ?? "the subject";
    const pct = Number(exam.percentage ?? 0);

    let remark = "";
    if (LOVABLE_API_KEY) {
      const lines = criteria
        .map((c) => `- ${c.criteria_name}: ${c.obtained_marks}/${c.max_marks}`)
        .join("\n");
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content:
                "You write short, warm, parent-facing remarks for a Quran academy report card. 2-3 short sentences, plain language, encouraging but honest. Never use harsh or shaming words. Do not mention internal notes or staff.",
            },
            {
              role: "user",
              content: `Student: ${studentName}\nSubject: ${subjectName}\nOverall: ${pct}%\nCriteria:\n${lines}\nTeacher's internal note: ${exam.examiner_remarks ?? "none"}\n\nWrite the parent-facing remark only.`,
            },
          ],
        }),
      });
      if (resp.status === 429) return json(429, { error: "Rate limited — try again shortly" });
      if (resp.status === 402) return json(402, { error: "AI credits exhausted" });
      if (resp.ok) {
        const data = await resp.json();
        remark = String(data?.choices?.[0]?.message?.content ?? "").trim();
      }
    }

    if (!remark) {
      remark = pct >= 80
        ? `${studentName} did very well in ${subjectName} this month, scoring ${pct}%. Please keep up the daily practice at home.`
        : `${studentName} scored ${pct}% in ${subjectName} this month. With a little more regular practice at home, steady improvement is expected.`;
    }

    const lower = remark.toLowerCase();
    const matched = SENSITIVE_PATTERNS.filter((p) => lower.includes(p));
    const reasons: string[] = [];
    if (Number.isFinite(pct) && pct < threshold) reasons.push(`Overall marks ${pct}% below ${threshold}% threshold`);
    if (matched.length) reasons.push(`Sensitive wording: ${matched.slice(0, 3).join(", ")}`);

    const needsReview = reasons.length > 0;

    const { error: upErr } = await admin
      .from("exams")
      .update({
        public_remarks: remark,
        remarks_status: needsReview ? "needs_review" : "published",
        remarks_flag_reason: needsReview ? reasons.join(" · ") : null,
        remarks_auto_generated: true,
        remarks_generated_at: new Date().toISOString(),
      })
      .eq("id", examId);
    if (upErr) return json(500, { error: "Failed to save remark" });

    return json(200, { success: true, exam_id: examId, needs_review: needsReview, reason: reasons.join(" · ") || null, remark });
  } catch (e) {
    console.error("auto-report-remarks error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unexpected error" });
  }
});
