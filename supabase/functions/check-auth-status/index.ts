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

  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerErr } = await authedClient.auth.getUser(token);
  if (callerErr || !caller) return json(401, { error: "Invalid session" }, origin);

  // Check caller is admin/super_admin
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .in("role", ["super_admin", "admin"]);

  if (!callerRoles || callerRoles.length === 0) {
    return json(403, { error: "Forbidden" }, origin);
  }

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body?.profile_ids || !Array.isArray(body.profile_ids)) {
    return json(400, { error: "profile_ids array required" }, origin);
  }

  const profileIds: string[] = body.profile_ids.slice(0, 500); // cap at 500

  try {
    // Fetch all auth users in pages
    const authUserIds = new Set<string>();
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!users || users.length === 0) break;
      users.forEach(u => authUserIds.add(u.id));
      if (users.length < perPage) break;
      page++;
    }

    // Build result map
    const result: Record<string, boolean> = {};
    for (const pid of profileIds) {
      result[pid] = authUserIds.has(pid);
    }

    return json(200, result, origin);
  } catch (e) {
    console.error("Error checking auth status:", e);
    return json(500, { error: "Failed to check auth status" }, origin);
  }
});
