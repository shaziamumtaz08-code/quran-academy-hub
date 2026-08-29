/// <reference lib="deno.ns" />
import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DEFAULT_TEMP_PASSWORD = "AqtaLms@2026";

/**
 * Repairs student logins:
 *  - the login email in auth is re-synced to the AQT address shown on the
 *    credential sheet (this is why the sheet's addresses were rejected),
 *  - one uniform temporary password is set,
 *  - force_password_reset is raised so the student must choose their own
 *    password on first sign-in.
 *
 * body: { dry_run?: boolean, password?: string, scope?: "mismatched" | "all_students", profile_ids?: string[] }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["super_admin", "admin"]);
    if (!auth.ok) return json(auth.status, { error: auth.error });
    const admin = auth.adminClient as any;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = Boolean(body?.dry_run);
    const password = String(body?.password || DEFAULT_TEMP_PASSWORD);
    const scope = body?.scope === "all_students" ? "all_students" : "mismatched";
    const only: string[] | null = Array.isArray(body?.profile_ids) && body.profile_ids.length
      ? body.profile_ids
      : null;

    if (password.length < 8) return json(400, { error: "Password must be at least 8 characters" });

    const { data: roles, error: rErr } = await admin
      .from("user_roles").select("user_id").eq("role", "student");
    if (rErr) throw rErr;
    const studentIds = new Set<string>((roles || []).map((r: any) => r.user_id));

    const { data: profiles, error: pErr } = await admin
      .from("profiles").select("id, full_name, email");
    if (pErr) throw pErr;

    // current auth emails
    const authEmail = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) authEmail.set(u.id, (u.email || "").toLowerCase());
      if (data.users.length < 1000) break;
      page++;
    }

    const targets = (profiles || []).filter((p: any) => {
      if (!studentIds.has(p.id)) return false;
      if (only) return only.includes(p.id);
      const wanted = (p.email || "").toLowerCase().trim();
      if (!wanted) return false;
      if (scope === "all_students") return true;
      return authEmail.get(p.id) !== wanted;
    });

    const results: Array<Record<string, unknown>> = [];
    for (const p of targets) {
      const wanted = (p.email || "").toLowerCase().trim();
      const current = authEmail.get(p.id) || "";
      const row: Record<string, unknown> = {
        id: p.id,
        name: p.full_name,
        current_login: current,
        new_login: wanted,
        password,
        fixed: false,
      };
      if (dryRun) { results.push(row); continue; }

      const payload: Record<string, unknown> = { password, email_confirm: true };
      if (current !== wanted) payload.email = wanted;

      const { error: authErr } = await admin.auth.admin.updateUserById(p.id, payload);
      if (authErr) {
        row.error = authErr.message;
        results.push(row);
        continue;
      }
      const { error: upErr } = await admin
        .from("profiles").update({ force_password_reset: true }).eq("id", p.id);
      row.fixed = !upErr;
      if (upErr) row.error = upErr.message;
      results.push(row);
    }

    return json(200, { success: true, dry_run: dryRun, password, count: results.length, results });
  } catch (err: any) {
    console.error("student-login-repair failed:", err?.message);
    return json(500, { error: err?.message || "Unexpected error" });
  }
});
