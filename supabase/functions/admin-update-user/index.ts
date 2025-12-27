/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      error: "Backend is missing required configuration.",
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Missing auth token" });

    // Validate caller session
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await authedClient.auth.getUser(token);

    if (callerErr || !caller) return json(401, { error: "Invalid session" });

    // Use service role for privileged actions
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: only super_admin can update users
    const { data: callerRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRoleErr) return json(500, { error: callerRoleErr.message });
    if (callerRoleRow?.role !== "super_admin") {
      return json(403, { error: "Forbidden" });
    }

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? "").trim();
    const fullName = body?.fullName !== undefined ? String(body.fullName).trim() : undefined;
    const email = body?.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const whatsapp = body?.whatsapp !== undefined ? (body.whatsapp ? String(body.whatsapp).trim() : null) : undefined;
    const gender = body?.gender !== undefined ? (body.gender && ['male', 'female'].includes(body.gender) ? body.gender : null) : undefined;
    const age = body?.age !== undefined ? (body.age && typeof body.age === 'number' ? body.age : null) : undefined;
    const password = body?.password ? String(body.password) : undefined;

    if (!userId) {
      return json(400, { error: "Missing userId" });
    }

    // Update profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (email !== undefined) profileUpdate.email = email;
    if (whatsapp !== undefined) profileUpdate.whatsapp_number = whatsapp;
    if (gender !== undefined) profileUpdate.gender = gender;
    if (age !== undefined) profileUpdate.age = age;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileErr) return json(500, { error: profileErr.message });
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return json(400, { error: "Password must be at least 6 characters" });
      }

      const { error: passwordErr } = await adminClient.auth.admin.updateUserById(userId, {
        password,
      });

      if (passwordErr) return json(500, { error: passwordErr.message });
    }

    // Update email in auth if changed
    if (email !== undefined) {
      const { error: emailErr } = await adminClient.auth.admin.updateUserById(userId, {
        email,
      });
      
      if (emailErr) {
        console.log("Email update warning:", emailErr.message);
        // Don't fail if email update fails - profile is already updated
      }
    }

    return json(200, { success: true, userId });
  } catch (e) {
    console.error("Error updating user:", e);
    return json(500, {
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});
