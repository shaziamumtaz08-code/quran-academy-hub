import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

export type AuthResult =
  | { ok: true; userId: string; adminClient: ReturnType<typeof createClient> }
  | { ok: false; status: number; error: string };

/**
 * Require a caller session that holds one of the given roles.
 * Returns an admin (service-role) client on success.
 */
export async function requireRole(
  req: Request,
  allowedRoles: string[],
): Promise<AuthResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return { ok: false, status: 500, error: "Service not configured" };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Authentication required" };

  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authed.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: "Invalid session" };

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roles, error: rErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rErr) return { ok: false, status: 500, error: "Authorization check failed" };

  const has = (roles ?? []).some((r: { role: string }) => allowedRoles.includes(r.role));
  if (!has) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, userId: user.id, adminClient };
}

/**
 * Require any authenticated caller (no role requirement).
 * Returns an admin (service-role) client on success.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return { ok: false, status: 500, error: "Service not configured" };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Authentication required" };

  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authed.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: "Invalid session" };

  return { ok: true, userId: user.id, adminClient: createClient(SUPABASE_URL, SERVICE_KEY) };
}

/** Check whether a user holds any of the given roles (uses service-role client). */
export async function userHasRole(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  allowedRoles: string[],
): Promise<boolean> {
  const { data } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: { role: string }) => allowedRoles.includes(r.role));
}
