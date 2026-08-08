import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";
import { loadIdentityConfig, normaliseRegistrationType } from "../_shared/org-identity.ts";
import { isValidEmail, resolvePerson } from "../_shared/identity.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["super_admin", "admin", "admin_division"]);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAdmin = auth.adminClient;

    const { submission_id, course_id } = await req.json();

    if (!submission_id || !course_id) {
      return new Response(JSON.stringify({ error: "submission_id and course_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch submission
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("registration_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sub.status === "enrolled") {
      return new Response(JSON.stringify({ error: "Already enrolled", already_enrolled: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = (sub.data || {}) as Record<string, any>;
    const submittedEmail = (data.email || "").toLowerCase().trim();
    const ownStudentEmail = (data.student_email || "").toLowerCase().trim();
    const hasOwnEmail = data.student_has_own_email === true || data.student_has_own_email === "yes";
    const phone = (data.phone || data.whatsapp_number || "").trim();
    const fullName = data.full_name || submittedEmail.split("@")[0] || "Student";
    const city = data.city || null;
    const country = data.country || null;
    const rawGender = (data.gender || "").toLowerCase().trim();
    const gender = (rawGender === 'male' || rawGender === 'female') ? rawGender : null;

    // Workflow comes from the course's Registration Type — no manual choice.
    const { data: courseRow } = await supabaseAdmin
      .from("courses")
      .select("registration_type")
      .eq("id", course_id)
      .maybeSingle();
    const workflow = normaliseRegistrationType(courseRow?.registration_type);
    const config = await loadIdentityConfig(supabaseAdmin);

    const lookupEmail = ownStudentEmail || submittedEmail;
    const ownEmailConfirmed = workflow === "free" ? true : hasOwnEmail || Boolean(ownStudentEmail);

    if (workflow === "free" && !isValidEmail(lookupEmail)) {
      return new Response(JSON.stringify({ error: "Free course registration requires the student's own valid email address." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identity resolution: email is the only uniqueness key; phone never merges.
    const resolved = await resolvePerson(supabaseAdmin, {
      submittedEmail: lookupEmail,
      fullName,
      phone,
      role: "student",
      workflow,
      ownEmailConfirmed,
      config,
      profile: { city, country, gender },
    });

    if (!resolved.ok) {
      return new Response(JSON.stringify({ error: resolved.error, code: resolved.code }), {
        status: resolved.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileId = resolved.profileId;
    const matchedExisting = resolved.reusedExisting;

    // Ensure the profile carries a URN
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("registration_id")
      .eq("id", profileId)
      .maybeSingle();

    if (!existingProfile?.registration_id) {
      const { data: regId } = await supabaseAdmin.rpc("generate_registration_id", {
        _org_code: "AQT",
        _branch_code: "ONL",
        _role_code: "STU",
      });
      if (regId) {
        await supabaseAdmin.from("profiles").update({ registration_id: regId }).eq("id", profileId);
      }
    }


    // 4. Create course enrollment (skip if exists)
    let enrollmentId: string | null = null;

    const { data: existingEnrollment } = await supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("student_id", profileId)
      .limit(1);

    if (existingEnrollment?.length) {
      enrollmentId = existingEnrollment[0].id;
    } else {
      const { data: newEnrollment, error: enrollErr } = await supabaseAdmin
        .from("course_enrollments")
        .insert({
          course_id,
          student_id: profileId,
          status: "active",
          enrolled_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (enrollErr) {
        return new Response(JSON.stringify({ error: "Failed to create enrollment: " + enrollErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      enrollmentId = newEnrollment.id;
    }

    // 5. Update submission
    await supabaseAdmin
      .from("registration_submissions")
      .update({
        status: "enrolled",
        enrollment_id: enrollmentId,
        processed_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    return new Response(JSON.stringify({
      success: true,
      profile_id: profileId,
      enrollment_id: enrollmentId,
      matched_existing: matchedExisting,
      login_email: resolved.loginEmail,
      temp_password: resolved.authCreated ? resolved.password : undefined,
      generated_login: resolved.generatedLogin,
      duplicate_flagged_against: resolved.duplicateFlaggedAgainst ?? null,
      registration_workflow: workflow,
      student_name: fullName,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
