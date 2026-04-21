/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

type AppRole =
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "examiner"
  | "super_admin"
  | "admin_admissions"
  | "admin_fees"
  | "admin_academic";

// super_admin removal is NOT permitted via UI — DB-level only
const REMOVABLE_ROLES: AppRole[] = [
  "admin",
  "admin_admissions",
  "admin_fees",
  "admin_academic",
  "teacher",
  "examiner",
  "student",
  "parent",
];

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function json(status: number, body: unknown, requestOrigin?: string | null) {
  const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, requestOrigin);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token === "undefined" || token === "null") {
      return json(401, { error: "Authentication required" }, requestOrigin);
    }

    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerErr } = await authedClient.auth.getUser(token);
    if (callerErr || !caller) {
      return json(401, { error: callerErr?.message || "Invalid session" }, requestOrigin);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Only super_admin may remove roles
    const { data: callerRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (callerRoleErr) return json(500, { error: "Authorization check failed" }, requestOrigin);
    if (!callerRoleRow) return json(403, { error: "Forbidden - super_admin role required" }, requestOrigin);

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid request body" }, requestOrigin);

    const userId = String(body?.userId ?? "").trim();
    const role = String(body?.role ?? "") as AppRole;

    if (!userId || !isValidUUID(userId)) {
      return json(400, { error: "Invalid user ID" }, requestOrigin);
    }

    // Block super_admin removal via UI
    if (role === "super_admin") {
      return json(403, { error: "Super admin role can only be removed at the database level" }, requestOrigin);
    }
    if (!role || !REMOVABLE_ROLES.includes(role)) {
      return json(400, { error: `Invalid role. Removable: ${REMOVABLE_ROLES.join(", ")}` }, requestOrigin);
    }

    // Fetch current roles for last-role guard
    const { data: currentRolesRows, error: currentRolesErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (currentRolesErr) return json(500, { error: "Failed to read current roles" }, requestOrigin);

    const currentRoles = (currentRolesRows || []).map(r => r.role as AppRole);

    if (!currentRoles.includes(role)) {
      return json(404, { error: "User does not have this role" }, requestOrigin);
    }

    if (currentRoles.length <= 1) {
      return json(409, { error: "Cannot remove the user's only remaining role" }, requestOrigin);
    }

    // Delete the role
    const { error: delErr } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (delErr) {
      return json(500, { error: "Failed to remove role: " + delErr.message }, requestOrigin);
    }

    // Audit
    await adminClient.from("user_activity_log").insert({
      user_id: userId,
      actor_id: caller.id,
      action: "role_removed",
      metadata: { role, reason: "manual_removal" },
    });

    return json(200, {
      success: true,
      userId,
      role,
      message: `Role '${role}' removed successfully`,
    }, requestOrigin);

  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
