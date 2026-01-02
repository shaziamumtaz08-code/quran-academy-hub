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

// Input validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidPassword(password: string): boolean {
  // At least 8 chars, max 100
  return password.length >= 8 && password.length <= 100;
}

function isValidFullName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

function isValidWhatsApp(phone: string | null | undefined): boolean {
  // Allow null, undefined, or empty/whitespace-only strings
  if (!phone || phone.trim() === '') return true;
  // Basic phone validation: optional +, then 7-15 digits, allowing spaces/dashes/dots
  const cleanedPhone = phone.replace(/[\s\-\.()]/g, '');
  // Be more lenient - just check it has at least 7 digits and max 20 chars
  const phoneRegex = /^\+?[0-9]{7,20}$/;
  return phoneRegex.test(cleanedPhone);
}

function isValidAge(age: number | null): boolean {
  if (age === null) return true; // nullable
  return Number.isInteger(age) && age >= 3 && age <= 120;
}

function isValidGender(gender: string | null): boolean {
  if (!gender) return true; // nullable
  return ['male', 'female'].includes(gender);
}

function sanitizeString(str: string): string {
  // Remove potentially dangerous characters
  return str.replace(/[<>]/g, '');
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

  const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    "";
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

    // Authorization: only super_admin can create users
    const { data: superAdminRoleRow, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (callerRoleErr) {
      console.error("Role check failed:", callerRoleErr.message);
      return json(500, { error: "Authorization check failed" }, requestOrigin);
    }
    if (!superAdminRoleRow) {
      return json(403, { error: "Forbidden" }, requestOrigin);
    }

    // Parse and validate input
    const body = await req.json().catch(() => null);
    if (!body) {
      return json(400, { error: "Invalid request body" }, requestOrigin);
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = sanitizeString(String(body?.fullName ?? "").trim());
    const role = String(body?.role ?? "student") as AppRole;
    const whatsapp = body?.whatsapp ? sanitizeString(String(body.whatsapp).trim()) : null;
    const gender = body?.gender ? String(body.gender).toLowerCase() : null;
    const age = body?.age !== undefined && body?.age !== null && typeof body.age === 'number' ? body.age : null;

    // Validate all inputs
    const validationErrors: string[] = [];

    if (!email) {
      validationErrors.push("Email is required");
    } else if (!isValidEmail(email)) {
      validationErrors.push("Invalid email format");
    }

    if (!fullName) {
      validationErrors.push("Full name is required");
    } else if (!isValidFullName(fullName)) {
      validationErrors.push("Full name must be 2-100 characters");
    }

    if (!ALLOWED_ROLES.includes(role)) {
      validationErrors.push("Invalid role specified");
    }

    if (!isValidWhatsApp(whatsapp)) {
      validationErrors.push("Invalid phone number format");
    }

    if (!isValidGender(gender)) {
      validationErrors.push("Invalid gender value");
    }

    if (!isValidAge(age)) {
      validationErrors.push("Age must be between 3 and 120");
    }

    if (validationErrors.length > 0) {
      return json(400, { error: validationErrors.join(", ") }, requestOrigin);
    }

    // Check if user with this email already exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError.message);
      return json(500, { error: "Failed to process request" }, requestOrigin);
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
        return json(400, { error: `User already has the ${role} role` }, requestOrigin);
      }

      // Add the new role
      const { error: roleErr } = await adminClient.from("user_roles").insert({
        user_id: existingUserId,
        role,
      });

      if (roleErr) {
        console.error("Error adding role:", roleErr.message);
        return json(500, { error: "Failed to assign role" }, requestOrigin);
      }

      console.log(`Added role ${role} to existing user ${email}`);

      return json(200, {
        userId: existingUserId,
        email,
        role,
        message: `Role '${role}' added to existing user`,
        roleAdded: true,
      }, requestOrigin);
    }

    // User doesn't exist - create new user
    if (!password) {
      return json(400, { error: "Password is required for new users" }, requestOrigin);
    }

    if (!isValidPassword(password)) {
      return json(400, { error: "Password must be 8-100 characters" }, requestOrigin);
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      console.error("Error creating user:", createErr?.message);
      return json(400, { error: "Failed to create user account" }, requestOrigin);
    }

    const newUserId = created.user.id;

    // Create/Update profile with additional fields
    const { error: profileErr } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        whatsapp_number: whatsapp,
        gender: isValidGender(gender) ? gender : null,
        age: isValidAge(age) ? age : null,
      },
      { onConflict: "id" },
    );

    if (profileErr) {
      console.error("Error creating profile:", profileErr.message);
      return json(500, { error: "User created but profile setup failed" }, requestOrigin);
    }

    // Add the role
    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role,
    });

    if (roleErr) {
      console.error("Error adding role:", roleErr.message);
      return json(500, { error: "User created but role assignment failed" }, requestOrigin);
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
    }, requestOrigin);
  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
