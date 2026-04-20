/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

// Input validation functions
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 100;
}

function isValidFullName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

function isValidWhatsApp(phone: string | null | undefined): boolean {
  if (!phone || phone.trim() === "") return true;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return true;
  return digits.length >= 7 && digits.length <= 20;
}


function isValidAge(age: number | null): boolean {
  if (age === null) return true;
  return Number.isInteger(age) && age >= 3 && age <= 120;
}

function isValidGender(gender: string | null): boolean {
  if (!gender) return true;
  return ['male', 'female'].includes(gender);
}

function sanitizeString(str: string): string {
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

    // Authorization: only super_admin can update users
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

    // Validate optional fields
    const validationErrors: string[] = [];

    const fullName = body?.fullName !== undefined ? sanitizeString(String(body.fullName).trim()) : undefined;
    const email = body?.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const whatsapp = body?.whatsapp !== undefined ? (body.whatsapp ? sanitizeString(String(body.whatsapp).trim()) : null) : undefined;
    const gender = body?.gender !== undefined ? (body.gender ? String(body.gender).toLowerCase() : null) : undefined;
    const age = body?.age !== undefined ? (body.age !== null && typeof body.age === 'number' ? body.age : null) : undefined;
    const country = body?.country !== undefined ? (body.country ? sanitizeString(String(body.country).trim()) : null) : undefined;
    const city = body?.city !== undefined ? (body.city ? sanitizeString(String(body.city).trim()) : null) : undefined;
    const password = body?.password ? String(body.password) : undefined;

    if (fullName !== undefined && !isValidFullName(fullName)) {
      validationErrors.push("Full name must be 2-100 characters");
    }

    if (email !== undefined && !isValidEmail(email)) {
      validationErrors.push("Invalid email format");
    }

    if (whatsapp !== undefined && !isValidWhatsApp(whatsapp)) {
      validationErrors.push("Invalid phone number format");
    }

    if (gender !== undefined && !isValidGender(gender)) {
      validationErrors.push("Invalid gender value");
    }

    if (age !== undefined && !isValidAge(age)) {
      validationErrors.push("Age must be between 3 and 120");
    }

    if (password !== undefined && !isValidPassword(password)) {
      validationErrors.push("Password must be 8-100 characters");
    }

    if (validationErrors.length > 0) {
      return json(400, { error: validationErrors.join(", ") }, requestOrigin);
    }

    // Update profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (email !== undefined) profileUpdate.email = email;
    if (whatsapp !== undefined) profileUpdate.whatsapp_number = whatsapp;
    if (gender !== undefined) profileUpdate.gender = gender;
    if (age !== undefined) profileUpdate.age = age;
    if (country !== undefined) profileUpdate.country = country;
    if (city !== undefined) profileUpdate.city = city;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileErr) {
        console.error("Profile update error:", profileErr.message);
        return json(500, { error: "Failed to update profile" }, requestOrigin);
      }
    }

    // Update password if provided
    if (password) {
      // First check if auth user exists
      const { data: authUser, error: getUserErr } = await adminClient.auth.admin.getUserById(userId);

      if (getUserErr || !authUser?.user) {
        // Auth user doesn't exist — create one using profile email
        const profileEmail = email ?? (await adminClient.from("profiles").select("email").eq("id", userId).single()).data?.email;
        if (profileEmail) {
          const { error: createErr } = await adminClient.auth.admin.createUser({
            id: userId,
            email: profileEmail,
            password,
            email_confirm: true,
          });
          if (createErr) {
            console.error("Auth account creation error:", createErr.message);
            return json(500, { error: "Failed to create auth account: " + createErr.message }, requestOrigin);
          }
          console.log(`Created auth account for ${userId}`);
        } else {
          return json(400, { error: "No email found to create auth account" }, requestOrigin);
        }
      } else {
        const { error: passwordErr } = await adminClient.auth.admin.updateUserById(userId, {
          password,
        });
        if (passwordErr) {
          console.error("Password update error:", passwordErr.message);
          const msg = passwordErr.message || "";
          const isWeak = /weak|pwned|known|easy to guess|breached/i.test(msg);
          return json(isWeak ? 400 : 500, {
            error: isWeak
              ? "This password is too common or has appeared in a data breach. Please choose a stronger password."
              : "Failed to update password",
          }, requestOrigin);
        }
      }
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

    console.log(`User ${userId} updated successfully`);

    return json(200, { success: true, userId }, requestOrigin);
  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
