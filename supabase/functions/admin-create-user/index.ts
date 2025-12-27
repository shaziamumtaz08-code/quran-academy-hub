/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

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
      error:
        "Backend is missing required configuration (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).",
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

    // Authorization: only super_admin can create users
    // NOTE: user_roles can contain multiple rows per user (multi-role). We must not use maybeSingle() without filtering.
    const { data: superAdminRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (callerRoleErr) return json(500, { error: callerRoleErr.message });
    if (!superAdminRoleRow) {
      return json(403, { error: "Forbidden" });
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = String(body?.fullName ?? "").trim();
    const role = String(body?.role ?? "student") as AppRole;
    const whatsapp = body?.whatsapp ? String(body.whatsapp).trim() : null;
    const gender = body?.gender && ['male', 'female'].includes(body.gender) ? body.gender : null;
    const age = body?.age && typeof body.age === 'number' ? body.age : null;

    if (!email || !fullName) {
      return json(400, { error: "Missing required fields (email, fullName)" });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return json(400, { error: "Invalid role" });
    }

    // Check if user with this email already exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return json(500, { error: "Failed to check existing users" });
    }

    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingUser) {
      // User exists - just add the new role if not already assigned
      const existingUserId = existingUser.id;

      // Check if user already has this role
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", existingUserId)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        return json(400, { error: `User already has the ${role} role` });
      }

      // Add the new role
      const { error: roleErr } = await adminClient.from("user_roles").insert({
        user_id: existingUserId,
        role,
      });

      if (roleErr) {
        console.error("Error adding role:", roleErr);
        return json(500, { error: roleErr.message });
      }

      console.log(`Added role ${role} to existing user ${email}`);

      return json(200, {
        userId: existingUserId,
        email,
        role,
        message: `Role '${role}' added to existing user`,
        roleAdded: true,
      });
    }

    // User doesn't exist - create new user
    if (!password) {
      return json(400, { error: "Password is required for new users" });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      console.error("Error creating user:", createErr);
      return json(400, { error: createErr?.message ?? "Failed to create user" });
    }

    const newUserId = created.user.id;

    // Create/Update profile with additional fields
    const { error: profileErr } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        whatsapp_number: whatsapp,
        gender,
        age,
      },
      { onConflict: "id" },
    );

    if (profileErr) {
      console.error("Error creating profile:", profileErr);
      return json(500, { error: profileErr.message });
    }

    // Add the role (don't delete existing - this is a new user)
    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role,
    });

    if (roleErr) {
      console.error("Error adding role:", roleErr);
      return json(500, { error: roleErr.message });
    }

    console.log(`Created new user ${email} with role ${role}`);

    return json(200, {
      userId: newUserId,
      email,
      full_name: fullName,
      role,
      whatsapp_number: whatsapp,
      gender,
      age,
      message: "User created successfully",
      roleAdded: false,
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return json(500, {
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});
