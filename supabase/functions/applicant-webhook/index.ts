import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { full_name, email, phone, gender, city, source, course_id, webhook_secret } = body;

    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id is required" }), { status: 400, headers: corsHeaders });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: "email or phone is required" }), { status: 400, headers: corsHeaders });
    }

    // Verify webhook secret
    const { data: course } = await supabaseAdmin.from("courses").select("id, webhook_secret, auto_enroll_enabled").eq("id", course_id).single();
    if (!course) {
      return new Response(JSON.stringify({ error: "Course not found" }), { status: 404, headers: corsHeaders });
    }
    if (course.webhook_secret && course.webhook_secret !== webhook_secret) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), { status: 401, headers: corsHeaders });
    }

    // Dedup
    const emailLower = (email || "").toLowerCase().trim();
    const phoneTrimmed = (phone || "").trim();
    let existingProfile: any = null;

    if (emailLower) {
      const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email").eq("email", emailLower).limit(1);
      if (data?.length) existingProfile = data[0];
    }
    if (!existingProfile && phoneTrimmed) {
      const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email").eq("phone", phoneTrimmed).limit(1);
      if (data?.length) existingProfile = data[0];
    }

    // Check eligibility
    const { data: rules } = await supabaseAdmin
      .from("course_eligibility_rules")
      .select("*")
      .eq("course_id", course_id)
      .eq("is_active", true);

    let eligible = true;
    const eligibilityNotes: string[] = [];

    if (existingProfile && rules && rules.length > 0) {
      for (const rule of rules) {
        if (rule.rule_type === "prerequisite_course") {
          const prereqId = (rule.rule_value as any)?.course_id;
          if (prereqId) {
            const { data: enrollment } = await supabaseAdmin
              .from("course_enrollments")
              .select("id, status")
              .eq("student_id", existingProfile.id)
              .eq("course_id", prereqId)
              .eq("status", "completed")
              .limit(1);
            if (!enrollment?.length) {
              eligible = false;
              eligibilityNotes.push("Prerequisite course not completed");
            }
          }
        }
        if (rule.rule_type === "min_attendance") {
          const threshold = (rule.rule_value as any)?.threshold || 0;
          // Check attendance for prerequisite or same course
          const { data: attendanceData } = await supabaseAdmin
            .from("attendance")
            .select("status")
            .eq("student_id", existingProfile.id)
            .eq("course_id", course_id);
          if (attendanceData && attendanceData.length > 0) {
            const present = attendanceData.filter(a => a.status === "present").length;
            const rate = (present / attendanceData.length) * 100;
            if (rate < threshold) {
              eligible = false;
              eligibilityNotes.push(`Attendance ${rate.toFixed(0)}% below required ${threshold}%`);
            }
          }
        }
        if (rule.rule_type === "must_pass_exam") {
          // Check if student passed any exam for this course
          const { data: examResults } = await supabaseAdmin
            .from("teaching_exam_submissions")
            .select("score, exam:teaching_exams!inner(course_id)")
            .eq("student_id", existingProfile.id);
          const relevant = examResults?.filter((e: any) => e.exam?.course_id === course_id);
          if (!relevant?.length || !relevant.some((e: any) => e.score >= 50)) {
            eligible = false;
            eligibilityNotes.push("Required exam not passed");
          }
        }
      }
    }

    // Create submission
    const sourceTag = source || "webhook";
    const { data: submission, error: subErr } = await supabaseAdmin.from("registration_submissions").insert({
      form_id: course_id,
      course_id,
      data: { full_name, email: emailLower, phone: phoneTrimmed, gender, city },
      status: eligible ? "new" : "rejected",
      source_tag: sourceTag,
      eligibility_status: eligible ? "eligible" : "not_eligible",
      eligibility_notes: eligibilityNotes.length > 0 ? eligibilityNotes.join("; ") : null,
    }).select("id").single();

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: corsHeaders });
    }

    // Auto-enroll if eligible and course has auto_enroll_enabled
    let autoEnrolled = false;
    if (eligible && course.auto_enroll_enabled && existingProfile) {
      // Check not already enrolled
      const { data: existing } = await supabaseAdmin
        .from("course_enrollments")
        .select("id")
        .eq("course_id", course_id)
        .eq("student_id", existingProfile.id)
        .limit(1);

      if (!existing?.length) {
        const { data: enrollment } = await supabaseAdmin.from("course_enrollments").insert({
          course_id,
          student_id: existingProfile.id,
          status: "active",
        }).select("id").single();

        if (enrollment) {
          await supabaseAdmin.from("registration_submissions").update({
            status: "enrolled",
            processed_at: new Date().toISOString(),
            enrollment_id: enrollment.id,
          }).eq("id", submission.id);
          autoEnrolled = true;
        }
      }
    }

    return new Response(JSON.stringify({
      status: autoEnrolled ? "enrolled" : (eligible ? "accepted" : "rejected"),
      matched_existing: !!existingProfile,
      auto_enrolled: autoEnrolled,
      eligibility_notes: eligibilityNotes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
