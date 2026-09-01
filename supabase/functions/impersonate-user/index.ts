/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

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
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !ANON || !SERVICE) return json(500, { error: "Service unavailable" }, origin);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Authentication required" }, origin);

    const authed = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Primary: full user lookup. Falls back to JWT claim verification, which
    // still works when the auth server reports the session row as missing
    // (e.g. the session was signed out on another device) but the token itself
    // is validly signed and unexpired.
    let callerId = "";
    const { data: userRes } = await authed.auth.getUser(token);
    if (userRes?.user?.id) {
      callerId = userRes.user.id;
    } else {
      const { data: claimsRes } = await authed.auth.getClaims(token);
      const sub = (claimsRes as any)?.claims?.sub;
      if (sub) {
        // Confirm the user still exists before trusting the claim.
        const { data: u } = await admin.auth.admin.getUserById(String(sub));
        if (u?.user?.id) callerId = u.user.id;
      }
    }
    if (!callerId) return json(401, { error: "Invalid session" }, origin);
    const caller = { id: callerId };

    // Only super_admin or admin can impersonate
    const { data: callerRoles } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roleSet = new Set((callerRoles ?? []).map((r: any) => r.role));
    if (!roleSet.has("super_admin") && !roleSet.has("admin")) {
      return json(403, { error: "Only super admin or admin can impersonate users" }, origin);
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.targetUserId ? String(body.targetUserId) : "";
    const redirectTo = body?.redirectTo ? String(body.redirectTo) : `${origin || ""}/dashboard`;
    if (!targetUserId) return json(400, { error: "targetUserId required" }, origin);
    if (targetUserId === caller.id) return json(400, { error: "Cannot impersonate yourself" }, origin);

    // Get target email
    const { data: targetUser, error: tErr } = await admin.auth.admin.getUserById(targetUserId);
    if (tErr || !targetUser?.user?.email) {
      return json(404, { error: "Target user not found or has no email" }, origin);
    }
    const email = targetUser.user.email;

    // Block impersonating other super admins unless caller is super admin
    const { data: targetRoles } = await admin
      .from("user_roles").select("role").eq("user_id", targetUserId);
    const tSet = new Set((targetRoles ?? []).map((r: any) => r.role));
    if (tSet.has("super_admin") && !roleSet.has("super_admin")) {
      return json(403, { error: "Cannot impersonate a super admin" }, origin);
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return json(500, { error: linkErr?.message || "Failed to generate impersonation link" }, origin);
    }

    // Audit log (best effort)
    try {
      await admin.from("user_activity_log").insert({
        user_id: caller.id,
        action: "impersonate_user",
        entity_type: "auth",
        entity_label: `Impersonated ${email}`,
        metadata: { target_user_id: targetUserId },
      } as any);
    } catch { /* noop */ }

    return json(200, {
      actionLink: linkData.properties.action_link,
      tokenHash: linkData.properties.hashed_token,
      email,
      targetUserId,
    }, origin);
  } catch (e: any) {
    return json(500, { error: e?.message || "Unexpected error" }, origin);
  }
});
