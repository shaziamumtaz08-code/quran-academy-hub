/// <reference lib="deno.ns" />
import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";
import { generateAqtEmail, generateInitialPassword, isAqtLogin } from "../_shared/aqt-email.ts";
import { defaultPasswordFor } from "../_shared/default-password.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Moves students who are still logging in with a parent's / shared inbox onto their
 * own AQT-branded, login-only address. Profiles, URNs and history stay untouched.
 *
 * body: { dry_run?: boolean, profile_ids?: string[] }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["super_admin", "admin", "admin_division"]);
    if (!auth.ok) return json(auth.status, { error: auth.error });
    const admin = auth.adminClient as any;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = Boolean(body?.dry_run);
    const only: string[] | null = Array.isArray(body?.profile_ids) && body.profile_ids.length
      ? body.profile_ids
      : null;

    const { data: roles, error: roleErr } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["student", "parent", "teacher"]);
    if (roleErr) throw roleErr;

    const studentIds = new Set<string>();
    const nonStudentIds = new Set<string>();
    for (const r of roles || []) {
      if (r.role === "student") studentIds.add(r.user_id);
      else nonStudentIds.add(r.user_id);
    }

    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name, email");
    if (pErr) throw pErr;

    const emailOwners = new Map<string, string[]>();
    for (const p of profiles || []) {
      const e = (p.email || "").toLowerCase().trim();
      if (!e) continue;
      emailOwners.set(e, [...(emailOwners.get(e) || []), p.id]);
    }

    const targets = (profiles || []).filter((p: any) => {
      if (!studentIds.has(p.id)) return false;
      if (only) return only.includes(p.id);
      const e = (p.email || "").toLowerCase().trim();
      if (!e || isAqtLogin(e)) return false;
      const owners = emailOwners.get(e) || [];
      // shared with anybody else, or owned by a parent/teacher account
      return owners.length > 1 || owners.some((id) => nonStudentIds.has(id));
    });

    const reserved = new Set<string>();
    const results: Array<Record<string, unknown>> = [];

    for (const student of targets) {
      const newEmail = await generateAqtEmail(admin, student.full_name || "Student", reserved);
      const password = defaultPasswordFor(student.full_name || "Student");

      if (dryRun) {
        results.push({
          id: student.id,
          name: student.full_name,
          old_email: student.email,
          new_email: newEmail,
          migrated: false,
        });
        continue;
      }

      const { error: authErr } = await admin.auth.admin.updateUserById(student.id, {
        email: newEmail,
        email_confirm: true,
        password,
      });
      if (authErr) {
        results.push({
          id: student.id,
          name: student.full_name,
          old_email: student.email,
          new_email: newEmail,
          migrated: false,
          error: authErr.message,
        });
        continue;
      }

      const { error: updErr } = await admin
        .from("profiles")
        .update({ email: newEmail, force_password_reset: false })
        .eq("id", student.id);

      results.push({
        id: student.id,
        name: student.full_name,
        old_email: student.email,
        new_email: newEmail,
        password,
        migrated: !updErr,
        error: updErr?.message,
      });
    }

    return json(200, { success: true, dry_run: dryRun, count: results.length, results });
  } catch (err: any) {
    console.error("migrate-student-logins failed:", err?.message);
    return json(500, { error: err?.message || "Unexpected error" });
  }
});
