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
    const { full_name, email, phone, gender, city, source, course_id, webhook_secret, extra } = body;

    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: "email or phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify course exists and check webhook secret
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id, webhook_secret, auto_enroll_enabled, name")
      .eq("id", course_id)
      .single();

    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate webhook secret
    if (course.webhook_secret) {
      if (!webhook_secret || course.webhook_secret !== webhook_secret) {
        return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Look up registration_forms for this course; auto-create if missing
    let formId: string;
    const { data: existingForm } = await supabaseAdmin
      .from("registration_forms")
      .select("id")
      .eq("course_id", course_id)
      .maybeSingle();

    if (existingForm) {
      formId = existingForm.id;
    } else {
      const { data: newForm, error: formErr } = await supabaseAdmin
        .from("registration_forms")
        .insert({
          course_id,
          slug: course_id,
          title: `${course.name || "Course"} Registration`,
        })
        .select("id")
        .single();

      if (formErr || !newForm) {
        return new Response(JSON.stringify({ error: "Failed to create registration form: " + (formErr?.message || "unknown") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      formId = newForm.id;
    }

    const emailLower = (email || "").toLowerCase().trim();
    const phoneTrimmed = (phone || "").trim();
    const sourceTag = source || "google_form";

    // Insert submission
    const { data: submission, error: subErr } = await supabaseAdmin
      .from("registration_submissions")
      .insert({
        form_id: formId,
        course_id,
        data: { full_name, email: emailLower, phone: phoneTrimmed, gender, city, ...(extra || {}) },
        source_tag: sourceTag,
        status: "new",
        eligibility_status: "pending",
      })
      .select("id")
      .single();

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      submission_id: submission.id,
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
