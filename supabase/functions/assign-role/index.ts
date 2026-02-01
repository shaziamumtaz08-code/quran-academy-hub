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

const ALLOWED_ROLES: AppRole[] = [
  "super_admin",
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
  
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, requestOrigin);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required environment variables");
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token || token === "undefined" || token === "null") {
      console.error("Auth missing:", {
        hasAuthHeader: !!authHeader,
        authHeaderPrefix: authHeader ? authHeader.slice(0, 20) : "",
      });
      return json(401, { error: "Authentication required" }, requestOrigin);
    }

    // Validate caller session
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerErr } = await authedClient.auth.getUser(token);

    if (callerErr || !caller) {
      console.error("Auth validation failed:", callerErr?.message);
      return json(401, { error: callerErr?.message || "Invalid session" }, requestOrigin);
    }

    // Use service role for privileged actions
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: only super_admin can assign roles
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
      console.error("User is not super_admin:", caller.id);
      return json(403, { error: "Forbidden - super_admin role required" }, requestOrigin);
    }

    // Parse and validate input
    const body = await req.json().catch(() => null);
    if (!body) {
      return json(400, { error: "Invalid request body" }, requestOrigin);
    }

    const userId = String(body?.userId ?? "").trim();
    const role = String(body?.role ?? "") as AppRole;

    console.log("Assign role request:", { userId, role });

    // Validate userId
    if (!userId) {
      return json(400, { error: "User ID is required" }, requestOrigin);
    }
    
    if (!isValidUUID(userId)) {
      return json(400, { error: "Invalid user ID format" }, requestOrigin);
    }

    // Validate role
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return json(400, { error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` }, requestOrigin);
    }

    // Check if user exists in profiles
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("Profile check failed:", profileErr.message);
      return json(500, { error: "Failed to verify user" }, requestOrigin);
    }

    if (!profile) {
      return json(404, { error: "User not found" }, requestOrigin);
    }

    // Check if user already has this role
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();

    if (existingRole) {
      // Return success with message - idempotent operation
      return json(200, { 
        success: true,
        alreadyExists: true,
        userId, 
        role, 
        message: `User already has the '${role}' role` 
      }, requestOrigin);
    }

    // Add the role
    const { error: insertErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (insertErr) {
      console.error("Failed to insert role:", insertErr.message, insertErr.details, insertErr.hint);
      return json(500, { error: "Failed to assign role: " + insertErr.message }, requestOrigin);
    }

    console.log(`Successfully assigned role '${role}' to user ${userId} (${profile.full_name})`);

    return json(200, {
      success: true,
      userId,
      role,
      message: `Role '${role}' assigned successfully`,
    }, requestOrigin);

  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
