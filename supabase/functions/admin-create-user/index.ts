/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

type AppRole =
  | "admin"
  | "admin_division"
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
  "admin_division",
  "admin_admissions",
  "admin_fees",
  "admin_academic",
  "teacher",
  "examiner",
  "student",
  "parent",
];

const ROLE_CODE_MAP: Record<AppRole, string> = {
  super_admin: "SA",
  admin: "ADM",
  admin_division: "ADV",
  admin_admissions: "ADA",
  admin_fees: "ADF",
  admin_academic: "ADC",
  teacher: "TCH",
  student: "STU",
  parent: "PAR",
  examiner: "EXM",
};

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 255;
}
function isValidPassword(password: string): boolean {
  return password.length >= 6 && password.length <= 100;
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
function isValidGender(g: string | null): boolean {
  if (!g) return true;
  return ["male", "female"].includes(g);
}
function sanitize(s: string): string {
  return s.replace(/[<>]/g, "");
}

async function ensureUserContext(
  admin: ReturnType<typeof createClient>,
  userId: string,
  branchId: string | null,
  divisionId: string | null,
  primaryRole: string | null,
) {
  try {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!org?.id) return;
    const { error } = await admin.rpc("ensure_user_context", {
      p_user_id: userId,
      p_organization_id: org.id,
      p_branch_id: branchId,
      p_division_id: divisionId,
      p_primary_role: primaryRole,
    });
    if (error) console.warn("[ensure_user_context]", error.message);
  } catch (e: any) {
    console.warn("[ensure_user_context]", e?.message);
  }
}

function json(status: number, body: unknown, requestOrigin?: string | null) {
  const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function generateRegId(
  admin: ReturnType<typeof createClient>,
  branchId: string | null,
  role: AppRole,
): Promise<string | null> {
  if (!branchId) return null;
  try {
    const { data: branch } = await admin
      .from("branches")
      .select("code, org_id")
      .eq("id", branchId)
      .maybeSingle();
    if (!branch?.code) return null;
    let orgCode = "ORG";
    if (branch.org_id) {
      const { data: org } = await admin
        .from("organizations")
        .select("code")
        .eq("id", branch.org_id)
        .maybeSingle();
      if (org?.code) orgCode = org.code;
    }
    const roleCode = ROLE_CODE_MAP[role] || "USR";
    const { data: regId, error } = await admin.rpc("generate_registration_id", {
      _org_code: orgCode,
      _branch_code: branch.code,
      _role_code: roleCode,
    });
    if (error) {
      console.error("regId error:", error.message);
      return null;
    }
    return regId as string;
  } catch (e) {
    console.error("regId failed:", e);
    return null;
  }
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
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Authentication required" }, requestOrigin);

    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await authedClient.auth.getUser(token);
    if (callerErr || !caller) return json(401, { error: "Invalid session" }, requestOrigin);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: super_admin or admin_division
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const callerRoleSet = new Set((callerRoles ?? []).map((r: any) => r.role));
    if (!callerRoleSet.has("super_admin") && !callerRoleSet.has("admin_division")) {
      return json(403, { error: "Forbidden" }, requestOrigin);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid request body" }, requestOrigin);

    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = sanitize(String(body?.fullName ?? "").trim());
    const roleProvided = body?.role !== undefined && body?.role !== null && String(body?.role).trim() !== "";
    const role = (roleProvided ? String(body.role) : "") as AppRole | "";
    const whatsapp = body?.whatsapp ? sanitize(String(body.whatsapp).trim()) : null;
    const gender = body?.gender ? String(body.gender).toLowerCase() : null;
    const country = body?.country ? sanitize(String(body.country).trim()) : null;
    const city = body?.city ? sanitize(String(body.city).trim()) : null;
    const branchId = body?.branch_id ? String(body.branch_id).trim() : null;
    const divisionId = body?.division_id ? String(body.division_id).trim() : null;

    // New profile fields
    const dateOfBirth = body?.date_of_birth ? String(body.date_of_birth).trim() : null;
    const nationality = body?.nationality ? sanitize(String(body.nationality).trim()) : null;
    const firstLanguage = body?.first_language ? sanitize(String(body.first_language).trim()) : null;
    const arabicLevel = body?.arabic_level ? sanitize(String(body.arabic_level).trim()) : null;
    const timezoneInput = body?.timezone ? String(body.timezone).trim() : null;
    const guardianType = body?.guardian_type ? String(body.guardian_type).trim() : null;

    // Add-role flow
    const addRoleOnly = body?.addRoleOnly === true;
    const existingUserId = body?.existingUserId ? String(body.existingUserId).trim() : null;

    // Parent linking
    const parentEmail = body?.parent_email ? String(body.parent_email).trim().toLowerCase() : null;
    const parentName = body?.parent_name ? sanitize(String(body.parent_name).trim()) : null;
    const parentExistingOnly = body?.parentExistingOnly === true;
    const explicitParentId = body?.parent_id ? String(body.parent_id).trim() : null;

    // ---------- ADD ROLE ONLY ----------
    if (addRoleOnly) {
      if (!existingUserId) return json(400, { error: "existingUserId required for addRoleOnly" }, requestOrigin);
      if (!roleProvided || !ALLOWED_ROLES.includes(role as AppRole)) return json(400, { error: "Invalid role" }, requestOrigin);
      if (role === "admin_division" && (!divisionId || !branchId)) {
        return json(400, { error: "Division and branch required for Division Admin" }, requestOrigin);
      }

      const { error: roleErr } = await adminClient
        .from("user_roles")
        .upsert({ user_id: existingUserId, role }, { onConflict: "user_id,role" });
      if (roleErr) return json(500, { error: "Failed to assign role" }, requestOrigin);

      if (role === "admin_division") {
        await ensureUserContext(adminClient, existingUserId, branchId, divisionId, role);
      }
      return json(200, {
        userId: existingUserId,
        role,
        roleAdded: true,
        message: `Role '${role}' added to existing user`,
      }, requestOrigin);
    }

    // ---------- VALIDATION ----------
    const errors: string[] = [];
    if (!email) errors.push("Email is required");
    else if (!isValidEmail(email)) errors.push("Invalid email format");
    if (!fullName) errors.push("Full name is required");
    else if (!isValidFullName(fullName)) errors.push("Full name must be 2-100 characters");
    if (roleProvided && !ALLOWED_ROLES.includes(role as AppRole)) errors.push("Invalid role specified");
    if (!isValidWhatsApp(whatsapp)) errors.push("Invalid phone number format");
    if (!isValidGender(gender)) errors.push("Invalid gender value");
    if (roleProvided && role === "admin_division" && (!divisionId || !branchId)) errors.push("Division and branch required for Division Admin");
    if (roleProvided && role === "student" && guardianType === "parent") {
      if (!parentEmail) errors.push("Parent email required");
      else if (parentEmail === email) errors.push("Parent email must differ from student email");
      if (!parentName) errors.push("Parent name required");
    }
    if (errors.length > 0) return json(400, { error: errors.join(", ") }, requestOrigin);

    // Resolve timezone if not provided
    let resolvedTimezone: string | null = timezoneInput;
    if (!resolvedTimezone && country) {
      const cl = country.toLowerCase();
      if (cl === "pakistan") resolvedTimezone = "Asia/Karachi";
      else if (cl === "canada") resolvedTimezone = "America/Toronto";
      else if (["uae", "united arab emirates"].includes(cl)) resolvedTimezone = "Asia/Dubai";
      else if (["usa", "united states"].includes(cl)) resolvedTimezone = "America/New_York";
      else if (["uk", "united kingdom"].includes(cl)) resolvedTimezone = "Europe/London";
      else if (cl === "saudi arabia") resolvedTimezone = "Asia/Riyadh";
      else if (cl === "qatar") resolvedTimezone = "Asia/Qatar";
      else if (cl === "belgium") resolvedTimezone = "Europe/Brussels";
      else if (cl === "australia") resolvedTimezone = "Australia/Sydney";
    }

    // ---------- HARD EMAIL UNIQUENESS ----------
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return json(409, {
        error: "EMAIL_EXISTS",
        message: `User with this email already exists (${existingProfile.full_name || email}). Use Add Role to assign an additional role.`,
        existingId: existingProfile.id,
        existingName: existingProfile.full_name,
      }, requestOrigin);
    }

    // ---------- CREATE NEW USER ----------
    let finalPassword = password;
    if (!finalPassword) {
      const rawFirst = fullName.split(/\s+/)[0] || "User";
      const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
      finalPassword = firstName + "1234";
    }
    if (!isValidPassword(finalPassword)) {
      return json(400, { error: "Password must be 6-100 characters" }, requestOrigin);
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created?.user) {
      // Auth account may already exist without profile — recover by linking
      if (createErr?.message?.includes("already been registered")) {
        const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const authUser = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
        if (authUser) {
          const regId = await generateRegId(adminClient, branchId, role);
          await adminClient.from("profiles").upsert({
            id: authUser.id,
            email,
            full_name: fullName,
            whatsapp_number: whatsapp,
            gender: isValidGender(gender) ? gender : null,
            country,
            city,
            timezone: resolvedTimezone,
            registration_id: regId,
            date_of_birth: dateOfBirth,
            nationality,
            first_language: firstLanguage,
            arabic_level: arabicLevel,
            guardian_type: guardianType,
          }, { onConflict: "id" });
          await adminClient.from("user_roles").upsert(
            { user_id: authUser.id, role },
            { onConflict: "user_id,role" },
          );
          await ensureUserContext(adminClient, authUser.id, branchId, divisionId, role);
          return json(200, { userId: authUser.id, email, role, registration_id: regId, message: "User linked to existing auth account" }, requestOrigin);
        }
      }
      return json(400, { error: createErr?.message || "Failed to create user account" }, requestOrigin);
    }

    const newUserId = created.user.id;
    const registrationId = await generateRegId(adminClient, branchId, role);

    const { error: profileErr } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        whatsapp_number: whatsapp,
        gender: isValidGender(gender) ? gender : null,
        country,
        city,
        timezone: resolvedTimezone,
        registration_id: registrationId,
        date_of_birth: dateOfBirth,
        nationality,
        first_language: firstLanguage,
        arabic_level: arabicLevel,
        guardian_type: guardianType,
      },
      { onConflict: "id" },
    );
    if (profileErr) {
      console.error("profile upsert error:", profileErr.message);
      return json(500, { error: "User created but profile setup failed" }, requestOrigin);
    }

    const { error: roleErr } = await adminClient
      .from("user_roles")
      .upsert({ user_id: newUserId, role }, { onConflict: "user_id,role" });
    if (roleErr) return json(500, { error: "User created but role assignment failed" }, requestOrigin);

    await ensureUserContext(adminClient, newUserId, branchId, divisionId, role);

    // ---------- PARENT LINKING ----------
    let parentLinked = false;
    let parentNotice: string | undefined;
    if (role === "student") {
      let parentIdToLink: string | null = explicitParentId;

      if (!parentIdToLink && guardianType === "parent" && parentEmail) {
        // Look up parent by email
        const { data: parentProfile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", parentEmail)
          .maybeSingle();

        if (parentProfile) {
          parentIdToLink = parentProfile.id;
        } else if (parentExistingOnly) {
          parentNotice = "Parent account not found with that email; student created without parent link";
        } else {
          // Create parent account
          const parentPassword = (parentName?.split(/\s+/)[0] || "Parent")
            .replace(/[^a-zA-Z]/g, "") + "1234";
          const { data: parentAuth, error: pAuthErr } = await adminClient.auth.admin.createUser({
            email: parentEmail,
            password: parentPassword,
            email_confirm: true,
            user_metadata: { full_name: parentName || "Parent" },
          });
          if (!pAuthErr && parentAuth?.user) {
            const pRegId = await generateRegId(adminClient, branchId, "parent");
            await adminClient.from("profiles").upsert({
              id: parentAuth.user.id,
              email: parentEmail,
              full_name: parentName || "Parent",
              registration_id: pRegId,
            }, { onConflict: "id" });
            await adminClient.from("user_roles").upsert(
              { user_id: parentAuth.user.id, role: "parent" },
              { onConflict: "user_id,role" },
            );
            await ensureUserContext(adminClient, parentAuth.user.id, branchId, divisionId, "parent");
            parentIdToLink = parentAuth.user.id;
          } else {
            parentNotice = `Parent creation failed: ${pAuthErr?.message || "unknown"}`;
          }
        }
      }

      if (parentIdToLink) {
        const { error: linkErr } = await adminClient
          .from("student_parent_links")
          .upsert(
            { student_id: newUserId, parent_id: parentIdToLink },
            { onConflict: "student_id,parent_id" },
          );
        if (linkErr) {
          parentNotice = `Parent link failed: ${linkErr.message}`;
        } else {
          parentLinked = true;
        }
      }
    }

    return json(200, {
      userId: newUserId,
      email,
      full_name: fullName,
      role,
      registration_id: registrationId,
      message: parentNotice || "User created successfully",
      roleAdded: false,
      parentLinked,
    }, requestOrigin);
  } catch (e) {
    console.error("Unexpected:", e instanceof Error ? e.message : "Unknown");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
