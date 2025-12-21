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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing env vars");
    return json(500, { error: "Backend misconfigured" });
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

    if (callerErr || !caller) {
      console.error("Auth error:", callerErr);
      return json(401, { error: "Invalid session" });
    }

    // Use service role for privileged actions
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: only super_admin can delete users
    const { data: callerRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRoleErr) {
      console.error("Role check error:", callerRoleErr);
      return json(500, { error: callerRoleErr.message });
    }
    
    if (callerRoleRow?.role !== "super_admin") {
      return json(403, { error: "Forbidden - super_admin required" });
    }

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? "").trim();

    if (!userId) {
      return json(400, { error: "Missing userId" });
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return json(400, { error: "Cannot delete yourself" });
    }

    console.log(`Deleting user: ${userId}`);

    // Delete from auth (this cascades to profiles due to FK)
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteErr) {
      console.error("Delete error:", deleteErr);
      return json(400, { error: deleteErr.message });
    }

    console.log(`User ${userId} deleted successfully`);

    return json(200, { success: true, deletedUserId: userId });
  } catch (e) {
    console.error("Unexpected error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
