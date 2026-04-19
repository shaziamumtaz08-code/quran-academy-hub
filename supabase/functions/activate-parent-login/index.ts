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
  if (!roles || roles.length === 0) return json(403, { error: "Forbidden" }, origin);

  const body = await req.json().catch(() => null);
  const profileId = String(body?.profile_id ?? "").trim();
  if (!profileId) return json(400, { error: "profile_id required" }, origin);

  // Get profile
  const { data: profile, error: pErr } = await admin
    .from("profiles").select("id, email, full_name").eq("id", profileId).maybeSingle();
  if (pErr || !profile) return json(404, { error: "Profile not found" }, origin);
  if (!profile.email) return json(400, { error: "Profile has no email" }, origin);

  const email = profile.email.toLowerCase();
  const firstName = (profile.full_name || "User").split(/\s+/)[0];
  const cleanFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase().replace(/[^a-z]/g, "");
  const tempPassword = `${cleanFirst}@AQT2025`;

  try {
    // Check if auth user already exists by email
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);

    let authUserId: string;
    let created = false;

    if (existing) {
      authUserId = existing.id;
      // Reset password to known temp
      await admin.auth.admin.updateUserById(authUserId, { password: tempPassword, email_confirm: true });
    } else {
      const { data: createRes, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: profile.full_name },
      });
      if (cErr || !createRes?.user) {
        return json(500, { error: cErr?.message || "Failed to create auth user" }, origin);
      }
      authUserId = createRes.user.id;
      created = true;
    }

    // Sync profile id → auth uid if mismatch
    if (authUserId !== profile.id) {
      const tables = [
        "user_roles", "student_parent_links", "chat_members",
        "course_enrollments", "course_class_students", "attendance",
      ];
      // student_parent_links uses parent_id for parents
      await admin.from("student_parent_links").update({ parent_id: authUserId } as any).eq("parent_id", profile.id);
      await admin.from("user_roles").update({ user_id: authUserId } as any).eq("user_id", profile.id);
      await admin.from("chat_members").update({ user_id: authUserId } as any).eq("user_id", profile.id);
      await admin.from("profiles").update({ id: authUserId } as any).eq("id", profile.id);
    }

    // Send password recovery / invite email
    let inviteSent = false;
    try {
      await admin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      inviteSent = true;
    } catch (e) {
      console.warn("Invite email failed:", e);
    }

    return json(200, {
      success: true,
      created,
      authUserId,
      tempPassword,
      inviteSent,
    }, origin);
  } catch (e: any) {
    console.error("activate-parent-login error:", e);
    return json(500, { error: e?.message || "Internal error" }, origin);
  }
});
