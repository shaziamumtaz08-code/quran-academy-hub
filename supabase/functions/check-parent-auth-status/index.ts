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
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Service unavailable" }, origin);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(401, { error: "Unauthorized" }, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: uErr } = await authed.auth.getUser();
  if (uErr || !userData?.user?.id) return json(401, { error: "Invalid session" }, origin);

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", userData.user.id)
    .in("role", ["super_admin", "admin"]);
  if (!roles || roles.length === 0) return json(200, {}, origin);

  const body = await req.json().catch(() => null);
  if (!body?.profile_ids || !Array.isArray(body.profile_ids)) {
    return json(400, { error: "profile_ids array required" }, origin);
  }
  const profileIds: string[] = body.profile_ids.slice(0, 1000);

  try {
    // Build auth maps
    const authIds = new Set<string>();
    const authEmailToUser = new Map<string, { id: string; lastSignInAt: string | null }>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!users || users.length === 0) break;
      for (const u of users) {
        authIds.add(u.id);
        if (u.email) {
          authEmailToUser.set(u.email.toLowerCase(), {
            id: u.id,
            lastSignInAt: (u as any).last_sign_in_at ?? null,
          });
        }
      }
      if (users.length < perPage) break;
      page++;
    }

    // Fetch profile emails
    const profileEmails = new Map<string, string>();
    for (let i = 0; i < profileIds.length; i += 500) {
      const batch = profileIds.slice(i, i + 500);
      const { data: profiles } = await admin
        .from("profiles").select("id, email").in("id", batch);
      (profiles || []).forEach(p => {
        if (p.email) profileEmails.set(p.id, p.email.toLowerCase());
      });
    }

    const result: Record<string, { hasAuth: boolean; lastSignInAt: string | null }> = {};
    for (const pid of profileIds) {
      let hasAuth = false;
      let lastSignInAt: string | null = null;
      if (authIds.has(pid)) {
        hasAuth = true;
        // Find last sign in by id
        const email = profileEmails.get(pid);
        if (email && authEmailToUser.has(email)) {
          lastSignInAt = authEmailToUser.get(email)!.lastSignInAt;
        }
      } else {
        const email = profileEmails.get(pid);
        if (email && authEmailToUser.has(email)) {
          hasAuth = true;
          lastSignInAt = authEmailToUser.get(email)!.lastSignInAt;
        }
      }
      result[pid] = { hasAuth, lastSignInAt };
    }

    return json(200, result, origin);
  } catch (e: any) {
    console.error("check-parent-auth-status error:", e);
    return json(500, { error: e?.message || "Internal" }, origin);
  }
});
