import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // Check admin role
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { rows, courseId, formId, fieldMapping } = await req.json();

    if (!rows || !Array.isArray(rows) || !courseId) {
      return new Response(JSON.stringify({ error: "rows (array) and courseId required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch course auto-decide setting
    const { data: courseConfig } = await supabaseAdmin.from("courses")
      .select("auto_enroll_enabled")
      .eq("id", courseId)
      .single();
    const autoMode = courseConfig?.auto_enroll_enabled === true;

    // Fetch eligibility rules once
    const { data: rules } = await supabaseAdmin
      .from("course_eligibility_rules")
      .select("*")
      .eq("course_id", courseId)
      .eq("is_active", true);

    const results: any[] = [];
    let created = 0, matched = 0, errors = 0, autoEnrolled = 0, autoRejected = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped: Record<string, any> = {};
      
      if (fieldMapping) {
        for (const [csvCol, sysField] of Object.entries(fieldMapping)) {
          if (sysField && raw[csvCol] !== undefined) {
            mapped[sysField as string] = raw[csvCol];
          }
        }
      } else {
        Object.assign(mapped, raw);
      }

      const email = (mapped.email || "").toLowerCase().trim();
      const phone = (mapped.phone || "").trim();
      const fullName = (mapped.full_name || mapped.name || "").trim();

      if (!email && !phone) {
        results.push({ rowNum: i + 1, status: "error", error: "No email or phone provided" });
        errors++;
        continue;
      }

      // Dedup
      let existingProfile: any = null;
      if (email) {
        const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email, phone").eq("email", email).limit(1);
        if (data?.length) existingProfile = data[0];
      }
      if (!existingProfile && phone) {
        const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email, phone").eq("phone", phone).limit(1);
        if (data?.length) existingProfile = data[0];
      }

      // Run eligibility checks if profile exists and rules exist
      let eligible = true;
      const eligibilityNotes: string[] = [];

      if (existingProfile && rules && rules.length > 0) {
        for (const rule of rules) {
          if (rule.rule_type === "prerequisite_course") {
            const prereqId = (rule.rule_value as any)?.course_id;
            if (prereqId) {
              const { data: comp } = await supabaseAdmin.from("course_enrollments")
                .select("id").eq("student_id", existingProfile.id).eq("course_id", prereqId)
                .eq("status", "completed").limit(1);
              if (!comp?.length) {
                eligible = false;
                eligibilityNotes.push("Prerequisite course not completed");
              }
            }
          }
          if (rule.rule_type === "min_attendance") {
            const threshold = (rule.rule_value as any)?.threshold || 0;
            const { data: att } = await supabaseAdmin.from("attendance")
              .select("status").eq("student_id", existingProfile.id).eq("course_id", courseId);
            if (att && att.length > 0) {
              const rate = (att.filter(a => a.status === "present").length / att.length) * 100;
              if (rate < threshold) {
                eligible = false;
                eligibilityNotes.push(`Attendance ${rate.toFixed(0)}% below required ${threshold}%`);
              }
            }
          }
          if (rule.rule_type === "must_pass_exam") {
            const { data: exams } = await supabaseAdmin.from("teaching_exam_submissions")
              .select("score, exam:teaching_exams!inner(course_id)")
              .eq("student_id", existingProfile.id);
            const relevant = exams?.filter((e: any) => e.exam?.course_id === courseId);
            if (!relevant?.length || !relevant.some((e: any) => e.score >= 50)) {
              eligible = false;
              eligibilityNotes.push("Required exam not passed");
            }
          }
        }
      }

      // Determine submission status
      let submissionStatus = "new";
      let eligibilityStatus = eligible ? "eligible" : "not_eligible";

      if (autoMode && !eligible) {
        submissionStatus = "rejected";
      }

      const submissionData: Record<string, any> = { ...mapped };

      const { data: submission, error: subErr } = await supabaseAdmin.from("registration_submissions").insert({
        form_id: formId || courseId,
        course_id: courseId,
        data: submissionData,
        status: submissionStatus,
        source_tag: "csv_import",
        eligibility_status: eligibilityStatus,
        eligibility_notes: eligibilityNotes.length > 0 ? eligibilityNotes.join("; ") : null,
      }).select("id").single();

      if (subErr) {
        results.push({ rowNum: i + 1, status: "error", error: subErr.message });
        errors++;
        continue;
      }

      // Auto-enroll if auto mode + eligible + profile exists
      if (autoMode && eligible && existingProfile) {
        const { data: existing } = await supabaseAdmin.from("course_enrollments")
          .select("id").eq("course_id", courseId).eq("student_id", existingProfile.id).limit(1);

        if (!existing?.length) {
          const { data: enrollment } = await supabaseAdmin.from("course_enrollments").insert({
            course_id: courseId,
            student_id: existingProfile.id,
            status: "active",
          }).select("id").single();

          if (enrollment && submission) {
            await supabaseAdmin.from("registration_submissions").update({
              status: "enrolled",
              processed_at: new Date().toISOString(),
              enrollment_id: enrollment.id,
            }).eq("id", submission.id);
            autoEnrolled++;
          }
        }
      }

      if (autoMode && !eligible) {
        autoRejected++;
        results.push({ rowNum: i + 1, status: "rejected", reason: eligibilityNotes.join("; ") });
      } else if (existingProfile) {
        results.push({
          rowNum: i + 1,
          status: autoMode && eligible ? "auto_enrolled" : "matched",
          profileId: existingProfile.id,
          existingName: existingProfile.full_name,
          existingEmail: existingProfile.email,
        });
        matched++;
      } else {
        results.push({ rowNum: i + 1, status: "new", name: fullName, email });
        created++;
      }
    }

    return new Response(JSON.stringify({
      summary: { total: rows.length, new: created, matched, errors, auto_enrolled: autoEnrolled, auto_rejected: autoRejected },
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
