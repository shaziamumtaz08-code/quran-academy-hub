import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    const email = (data.email || "").toLowerCase().trim();
    const phone = (data.phone || data.whatsapp_number || "").trim();
    const fullName = data.full_name || email.split("@")[0] || "Student";
    const city = data.city || null;
    const country = data.country || null;
    const rawGender = (data.gender || "").toLowerCase().trim();
    const gender = (rawGender === 'male' || rawGender === 'female') ? rawGender : null;

    // Email is mandatory and must be valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "A valid email address is required before enrollment." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let profileId: string | null = null;
    let matchedExisting = false;

    // 1. Deduplicate by email
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .limit(1);
      if (existing?.length) {
        profileId = existing[0].id;
        matchedExisting = true;
      }
    }

    // 2. Deduplicate by phone
    if (!profileId && phone) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("whatsapp_number", phone)
        .limit(1);
      if (existing?.length) {
        profileId = existing[0].id;
        matchedExisting = true;
      }
    }

    // 3. Create new profile if not found
    if (!profileId) {
      const newId = crypto.randomUUID();
      const { error: insertErr } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: newId,
          full_name: fullName,
          email: email || null,
          whatsapp_number: phone || null,
          city: city,
          country: country,
          gender: gender,
        });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to create profile: " + insertErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profileId = newId;

      // Add student role
      await supabaseAdmin.from("user_roles").insert({
        user_id: newId,
        role: "student",
      });
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
      student_name: fullName,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
