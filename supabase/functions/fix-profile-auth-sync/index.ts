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

    // STEP 1: Find mismatched profiles by joining on email
    const { data: mismatched, error: qErr } = await supabaseAdmin.rpc("get_mismatched_profiles");

    // Fallback: if RPC doesn't exist, use raw approach via auth admin
    let rows: { profile_id: string; email: string; auth_id: string }[] = [];

    if (qErr || !mismatched) {
      // Manual approach: fetch all profiles, then check auth
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .not("email", "is", null);

      for (const p of (profiles || [])) {
        if (!p.email) continue;
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserByEmail(p.email);
          if (authData?.user && authData.user.id !== p.id) {
            rows.push({ profile_id: p.id, email: p.email, auth_id: authData.user.id });
          }
        } catch {
          // No auth user for this email, skip
        }
      }
    } else {
      rows = mismatched;
    }

    const details: { email: string; old_id: string; new_id: string; error?: string }[] = [];
    let fixed = 0;
    const failed: string[] = [];

    // STEP 2: Fix each mismatch
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
          // Target profile already exists — merge: update FKs to auth_id, delete old profile
          const fkUpdates = [
            supabaseAdmin.from("course_enrollments").update({ student_id: auth_id } as any).eq("student_id", profile_id),
            supabaseAdmin.from("course_class_students").update({ student_id: auth_id } as any).eq("student_id", profile_id),
            supabaseAdmin.from("user_roles").update({ user_id: auth_id } as any).eq("user_id", profile_id),
            supabaseAdmin.from("chat_members").update({ user_id: auth_id } as any).eq("user_id", profile_id),
            supabaseAdmin.from("attendance").update({ student_id: auth_id } as any).eq("student_id", profile_id),
          ];
          await Promise.all(fkUpdates);
          // Delete orphan profile
          await supabaseAdmin.from("profiles").delete().eq("id", profile_id);
        } else {
          // No conflict — update FKs first, then update profile PK
          await supabaseAdmin.from("course_enrollments").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          await supabaseAdmin.from("course_class_students").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          await supabaseAdmin.from("user_roles").update({ user_id: auth_id } as any).eq("user_id", profile_id);
          await supabaseAdmin.from("chat_members").update({ user_id: auth_id } as any).eq("user_id", profile_id);
          await supabaseAdmin.from("attendance").update({ student_id: auth_id } as any).eq("student_id", profile_id);
          // Update profile PK last
          await supabaseAdmin.from("profiles").update({ id: auth_id } as any).eq("id", profile_id);
        }

        fixed++;
        details.push({ email, old_id: profile_id, new_id: auth_id });
      } catch (e: any) {
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
