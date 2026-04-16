/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // STEP 1: Fetch all auth users via listUsers (paginated)
    const emailToAuthId = new Map<string, string>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error(`listUsers page ${page} error:`, error.message);
        break;
      }
      for (const u of users) {
        if (u.email) emailToAuthId.set(u.email.toLowerCase(), u.id);
      }
      if (users.length < perPage) break;
      page++;
    }
    console.log(`Loaded ${emailToAuthId.size} auth users`);

    // STEP 2: Fetch all profiles with email
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .not("email", "is", null);

    if (pErr) {
      console.error("Failed to fetch profiles:", pErr.message);
      return json(500, { error: pErr.message });
    }

    // STEP 3: Find mismatches
    const rows: { profile_id: string; email: string; auth_id: string }[] = [];
    for (const p of (profiles || [])) {
      if (!p.email) continue;
      const authId = emailToAuthId.get(p.email.toLowerCase());
      if (authId && authId !== p.id) {
        console.log(`MISMATCH: ${p.email} — profile=${p.id} auth=${authId}`);
        rows.push({ profile_id: p.id, email: p.email, auth_id: authId });
      }
    }
    console.log(`Found ${rows.length} mismatches`);

    const details: { email: string; old_id: string; new_id: string; error?: string }[] = [];
    let fixed = 0;
    const failed: string[] = [];

    // STEP 4: Fix each mismatch
    for (const row of rows) {
      const { profile_id, auth_id, email } = row;
      try {
        // Check if a profile with auth_id already exists (would cause PK conflict)
        const { data: existingTarget } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", auth_id)
          .limit(1);

        if (existingTarget?.length) {
          console.log(`${email}: target profile ${auth_id} exists — merging FKs and deleting orphan ${profile_id}`);
          const fkUpdates = [
            supabaseAdmin.from("course_enrollments").update({ student_id: auth_id } as any).eq("student_id", profile_id),
            supabaseAdmin.from("course_class_students").update({ student_id: auth_id } as any).eq("student_id", profile_id),
            supabaseAdmin.from("user_roles").update({ user_id: auth_id } as any).eq("user_id", profile_id),
            supabaseAdmin.from("chat_members").update({ user_id: auth_id } as any).eq("user_id", profile_id),
            supabaseAdmin.from("attendance").update({ student_id: auth_id } as any).eq("student_id", profile_id),
          ];
          await Promise.all(fkUpdates);
          await supabaseAdmin.from("profiles").delete().eq("id", profile_id);
        } else {
          console.log(`${email}: updating FKs then profile PK ${profile_id} → ${auth_id}`);
          await supabaseAdmin.from("course_enrollments").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          await supabaseAdmin.from("course_class_students").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          await supabaseAdmin.from("user_roles").update({ user_id: auth_id } as any).eq("user_id", profile_id);
          await supabaseAdmin.from("chat_members").update({ user_id: auth_id } as any).eq("user_id", profile_id);
          await supabaseAdmin.from("attendance").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          await supabaseAdmin.from("profiles").update({ id: auth_id } as any).eq("id", profile_id);
        }

        fixed++;
        details.push({ email, old_id: profile_id, new_id: auth_id });
        console.log(`✅ Fixed: ${email}`);
      } catch (e: any) {
        console.error(`❌ Failed: ${email} — ${e.message}`);
        failed.push(`${email}: ${e.message}`);
        details.push({ email, old_id: profile_id, new_id: auth_id, error: e.message });
      }
    }

    return json(200, {
      total_mismatched: rows.length,
      fixed,
      failed,
      details,
    });
  } catch (err: any) {
    console.error("fix-profile-auth-sync error:", err.message);
    return json(500, { error: err.message });
  }
});
