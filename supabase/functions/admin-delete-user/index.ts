/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, requestOrigin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required environment variables");
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Authentication required" }, requestOrigin);

    // Validate caller session
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await authedClient.auth.getUser(token);

    if (callerErr || !caller) {
      console.error("Auth validation failed:", callerErr?.message);
      return json(401, { error: "Invalid session" }, requestOrigin);
    }

    // Use service role for privileged actions
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: only super_admin can delete users
    const { data: callerRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (callerRoleErr) {
      console.error("Role check failed:", callerRoleErr.message);
      return json(500, { error: "Authorization check failed" }, requestOrigin);
    }
    
    if (!callerRoleRow) {
      return json(403, { error: "Forbidden" }, requestOrigin);
    }

    // Parse and validate input
    const body = await req.json().catch(() => null);
    if (!body) {
      return json(400, { error: "Invalid request body" }, requestOrigin);
    }

    const userId = String(body?.userId ?? "").trim();

    if (!userId) {
      return json(400, { error: "User ID is required" }, requestOrigin);
    }

    if (!isValidUUID(userId)) {
      return json(400, { error: "Invalid user ID format" }, requestOrigin);
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return json(400, { error: "Cannot delete your own account" }, requestOrigin);
    }

    console.log(`Deleting user: ${userId}`);

    // Delete from auth (this cascades to profiles due to FK)
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteErr) {
      console.error("Delete error:", deleteErr.message);
      return json(400, { error: "Failed to delete user" }, requestOrigin);
    }

    console.log(`User ${userId} deleted successfully`);

    return json(200, { success: true, deletedUserId: userId }, requestOrigin);
  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
