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

    const results: any[] = [];
    let created = 0, matched = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped: Record<string, any> = {};
      
      // Apply field mapping
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

      // Dedup: email first, then phone
      let existingProfile: any = null;
      if (email) {
        const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email, phone").eq("email", email).limit(1);
        if (data?.length) existingProfile = data[0];
      }
      if (!existingProfile && phone) {
        const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email, phone").eq("phone", phone).limit(1);
        if (data?.length) existingProfile = data[0];
      }

      // Create registration_submission
      const submissionData: Record<string, any> = { ...mapped };
      
      const { error: subErr } = await supabaseAdmin.from("registration_submissions").insert({
        form_id: formId || courseId,
        course_id: courseId,
        data: submissionData,
        status: "new",
        source_tag: "csv_import",
        eligibility_status: "pending",
      });

      if (subErr) {
        results.push({ rowNum: i + 1, status: "error", error: subErr.message });
        errors++;
        continue;
      }

      if (existingProfile) {
        results.push({
          rowNum: i + 1,
          status: "matched",
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
      summary: { total: rows.length, new: created, matched, errors },
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
