/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, getCorsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown, origin?: string | null) {
  const headers = origin ? getCorsHeaders(origin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: origin ? getCorsHeaders(origin) : corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { error: "Service unavailable" }, origin);
  }

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(401, { error: "Unauthorized" }, origin);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verify caller using anon client with the user's token in headers
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authedClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    console.error("getUser failed:", userErr);
    return json(401, { error: "Invalid session" }, origin);
  }
  const callerId = userData.user.id;

  // Check caller is admin/super_admin
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["super_admin", "admin"]);

  if (!callerRoles || callerRoles.length === 0) {
    // Non-admin caller: return empty result instead of error to avoid breaking UI
    return json(200, {}, origin);
  }

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body?.profile_ids || !Array.isArray(body.profile_ids)) {
    return json(400, { error: "profile_ids array required" }, origin);
  }

  const profileIds: string[] = body.profile_ids.slice(0, 500);

  try {
    // Build auth email→id and id set from all auth users
    const authUserIds = new Set<string>();
    const authEmailToId = new Map<string, string>();
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!users || users.length === 0) break;
      for (const u of users) {
        authUserIds.add(u.id);
        if (u.email) authEmailToId.set(u.email.toLowerCase(), u.id);
      }
      if (users.length < perPage) break;
      page++;
    }

    // Fetch emails for the requested profile IDs
    const profileEmails = new Map<string, string>();
    for (let i = 0; i < profileIds.length; i += 500) {
      const batch = profileIds.slice(i, i + 500);
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email")
        .in("id", batch);
      if (profiles) {
        for (const p of profiles) {
          if (p.email) profileEmails.set(p.id, p.email.toLowerCase());
        }
      }
    }

    // Build result: profile has auth if ID matches OR email matches
    const result: Record<string, boolean> = {};
    for (const pid of profileIds) {
      if (authUserIds.has(pid)) {
        result[pid] = true;
      } else {
        const email = profileEmails.get(pid);
        result[pid] = email ? authEmailToId.has(email) : false;
      }
    }

    return json(200, result, origin);
  } catch (e) {
    console.error("Error checking auth status:", e);
    return json(500, { error: "Failed to check auth status" }, origin);
  }
});
