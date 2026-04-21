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

const ROLE_CODE_MAP: Record<AppRole, string> = {
  super_admin: "SA",
  admin: "ADM",
  admin_admissions: "ADA",
  admin_fees: "ADF",
  admin_academic: "ADC",
  teacher: "TCH",
  student: "STU",
  parent: "PAR",
  examiner: "EXM",
};

// Input validation functions
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

/** Insert/refresh a user_context row. Non-fatal: warns and returns on any failure. */
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
    if (!org?.id) {
      console.warn("[ensure_user_context] no organization row found; skip");
      return;
    }
    const { error } = await admin.rpc("ensure_user_context", {
      p_user_id: userId,
      p_organization_id: org.id,
      p_branch_id: branchId,
      p_division_id: divisionId,
      p_primary_role: primaryRole,
    });
    if (error) console.warn("[ensure_user_context] failed:", error.message);
  } catch (e: any) {
    console.warn("[ensure_user_context] threw:", e?.message);
  }
}

function json(status: number, body: unknown, requestOrigin?: string | null) {
  const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Generate registration ID using the DB function */
async function generateRegId(
  adminClient: ReturnType<typeof createClient>,
  branchId: string | null,
  role: AppRole
): Promise<string | null> {
  if (!branchId) return null;

  try {
    // Get org code and branch code
    const { data: branch } = await adminClient
      .from("branches")
      .select("code, org_id")
      .eq("id", branchId)
      .maybeSingle();

    if (!branch?.code) return null;

    let orgCode = "ORG";
    if (branch.org_id) {
      const { data: org } = await adminClient
        .from("organizations")
        .select("code")
        .eq("id", branch.org_id)
        .maybeSingle();
      if (org?.code) orgCode = org.code;
    }

    const roleCode = ROLE_CODE_MAP[role] || "USR";

    const { data: regId, error } = await adminClient.rpc("generate_registration_id", {
      _org_code: orgCode,
      _branch_code: branch.code,
      _role_code: roleCode,
    });

    if (error) {
      console.error("Error generating registration ID:", error.message);
      return null;
    }

    return regId as string;
  } catch (e) {
    console.error("Registration ID generation failed:", e);
    return null;
  }
}

/** Auto-link student to parent */
async function linkStudentToParent(
  adminClient: ReturnType<typeof createClient>,
  studentId: string,
  parentId: string | null,
  email: string,
  forceNewProfile: boolean
): Promise<void> {
  try {
    if (parentId) {
      // Explicit parent link
      await adminClient.from("student_parent_links").upsert(
        { student_id: studentId, parent_id: parentId },
        { onConflict: "student_id,parent_id" }
      );
      console.log(`Linked student ${studentId} to parent ${parentId}`);
      return;
    }

    // Auto-detect: find parent for siblings sharing the same email
    if (forceNewProfile && email) {
      // Find other profiles with the same email
      const { data: sameEmailProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .neq("id", studentId);

      if (sameEmailProfiles && sameEmailProfiles.length > 0) {
        const siblingIds = sameEmailProfiles.map(p => p.id);

        // Check if any sibling is already linked to a parent
        const { data: existingLinks } = await adminClient
          .from("student_parent_links")
          .select("parent_id")
          .in("student_id", siblingIds)
          .limit(1);

        if (existingLinks && existingLinks.length > 0) {
          const detectedParentId = existingLinks[0].parent_id;
          await adminClient.from("student_parent_links").upsert(
            { student_id: studentId, parent_id: detectedParentId },
            { onConflict: "student_id,parent_id" }
          );
          console.log(`Auto-linked sibling ${studentId} to parent ${detectedParentId}`);
          return;
        }

        // Check if any profile with same email has parent role
        for (const p of sameEmailProfiles) {
          const { data: parentRole } = await adminClient
            .from("user_roles")
            .select("id")
            .eq("user_id", p.id)
            .eq("role", "parent")
            .maybeSingle();

          if (parentRole) {
            await adminClient.from("student_parent_links").upsert(
              { student_id: studentId, parent_id: p.id },
              { onConflict: "student_id,parent_id" }
            );
            console.log(`Auto-linked student ${studentId} to parent-role profile ${p.id}`);
            return;
          }
        }
      }
    }
  } catch (e) {
    console.error("Parent linking failed (non-fatal):", e);
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
    console.error("Missing required environment variables");
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Authentication required" }, requestOrigin);

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
    const country = body?.country ? sanitizeString(String(body.country).trim()) : 'Pakistan';
    const city = body?.city ? sanitizeString(String(body.city).trim()) : 'Karachi';
    const forceNewProfile = body?.forceNewProfile === true;
    const branchId = body?.branch_id ? String(body.branch_id).trim() : null;
    const parentId = body?.parent_id ? String(body.parent_id).trim() : null;

    // Resolve timezone from city/country using timezone_mappings
    let resolvedTimezone: string | null = null;
    if (city && country) {
      const { data: tzMapping } = await adminClient
        .from("timezone_mappings")
        .select("timezone")
        .ilike("country", country)
        .ilike("city", city)
        .maybeSingle();
      resolvedTimezone = tzMapping?.timezone || null;
    }
    if (!resolvedTimezone) {
      const countryLower = country.toLowerCase();
      if (countryLower === 'pakistan') resolvedTimezone = 'Asia/Karachi';
      else if (countryLower === 'canada') resolvedTimezone = 'America/Toronto';
      else if (['uae', 'united arab emirates'].includes(countryLower)) resolvedTimezone = 'Asia/Dubai';
      else if (['usa', 'united states'].includes(countryLower)) resolvedTimezone = 'America/New_York';
      else if (['uk', 'united kingdom'].includes(countryLower)) resolvedTimezone = 'Europe/London';
      else if (countryLower === 'saudi arabia') resolvedTimezone = 'Asia/Riyadh';
      else if (countryLower === 'india') resolvedTimezone = 'Asia/Kolkata';
      else if (countryLower === 'australia') resolvedTimezone = 'Australia/Sydney';
    }

    // Validate all inputs
    const validationErrors: string[] = [];

    if (!email) validationErrors.push("Email is required");
    else if (!isValidEmail(email)) validationErrors.push("Invalid email format");

    if (!fullName) validationErrors.push("Full name is required");
    else if (!isValidFullName(fullName)) validationErrors.push("Full name must be 2-100 characters");

    if (!ALLOWED_ROLES.includes(role)) validationErrors.push("Invalid role specified");
    if (!isValidWhatsApp(whatsapp)) validationErrors.push("Invalid phone number format");
    if (!isValidGender(gender)) validationErrors.push("Invalid gender value");
    if (!isValidAge(age)) validationErrors.push("Age must be between 3 and 120");

    if (validationErrors.length > 0) {
      return json(400, { error: validationErrors.join(", ") }, requestOrigin);
    }

    // Check if user with this email already exists (skip if forceNewProfile)
    let existingUser = null;
    if (!forceNewProfile) {
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        existingUser = { id: existingProfile.id, email: existingProfile.email };
      }
    }

    if (existingUser && !forceNewProfile) {
      const existingUserId = existingUser.id;

      // Check if existing profile has a conflicting role that suggests a separate person is needed
      // e.g., trying to add 'student' role to a profile that already has 'parent' role
      const { data: existingRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUserId);

      const existingRoleNames = (existingRoles || []).map((r: any) => r.role);

      // If adding student to a parent profile, or parent to a student profile, 
      // require forceNewProfile to create a separate person
      const conflictingPairs: [string, string][] = [
        ["student", "parent"],
        ["parent", "student"],
      ];

      for (const [newRole, existingRole] of conflictingPairs) {
        if (role === newRole && existingRoleNames.includes(existingRole)) {
          return json(400, {
            error: `This email already belongs to a profile with the '${existingRole}' role. To create a separate ${role} profile (e.g., a child), please check "Create as new person (sibling/family member)".`,
            requiresForceNew: true,
          }, requestOrigin);
        }
      }

      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", existingUserId)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        // Profile + role exist, but auth account might be missing — create it
        let authCreated = false;
        let tempPassword = "";
        try {
          const rawFirst = fullName.split(/\s+/)[0] || "User";
          const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
          tempPassword = password || (firstName + "1234");

          const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });

          if (authErr) {
            if (authErr.message?.includes("already been registered") || authErr.message?.includes("already exists")) {
              // Auth already exists — find via listUsers (getUserByEmail not available in this SDK version)
              const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const existingAuth = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
              if (existingAuth && existingAuth.id !== existingUserId) {
                const newAuthId = existingAuth.id;
                console.log(`Syncing profile ${existingUserId} → auth uid ${newAuthId}`);
                await adminClient.from("course_enrollments").update({ student_id: newAuthId } as any).eq("student_id", existingUserId);
                await adminClient.from("course_class_students").update({ student_id: newAuthId } as any).eq("student_id", existingUserId);
                await adminClient.from("user_roles").update({ user_id: newAuthId } as any).eq("user_id", existingUserId);
                await adminClient.from("chat_members").update({ user_id: newAuthId } as any).eq("user_id", existingUserId);
                await adminClient.from("attendance").update({ student_id: newAuthId } as any).eq("student_id", existingUserId);
                await adminClient.from("profiles").update({ id: newAuthId } as any).eq("id", existingUserId);
              }
              console.log(`Auth already exists for ${email}`);
            } else {
              console.error(`Auth creation failed for ${email}:`, authErr.message);
            }
          } else if (authData?.user) {
            authCreated = true;
            // Sync profile ID to match auth UUID
            if (authData.user.id !== existingUserId) {
              console.log(`Syncing profile ${existingUserId} → auth uid ${authData.user.id}`);
              await adminClient.from("course_enrollments").update({ student_id: authData.user.id } as any).eq("student_id", existingUserId);
              await adminClient.from("course_class_students").update({ student_id: authData.user.id } as any).eq("student_id", existingUserId);
              await adminClient.from("user_roles").update({ user_id: authData.user.id } as any).eq("user_id", existingUserId);
              await adminClient.from("chat_members").update({ user_id: authData.user.id } as any).eq("user_id", existingUserId);
              await adminClient.from("attendance").update({ student_id: authData.user.id } as any).eq("student_id", existingUserId);
              await adminClient.from("profiles").update({ id: authData.user.id } as any).eq("id", existingUserId);
            }
            console.log(`Auth account created for existing profile ${email}`);
          }
        } catch (e: any) {
          console.error(`Auth creation attempt failed for ${email}:`, e.message);
        }

        return json(200, {
          userId: existingUserId,
          email,
          role,
          message: authCreated
            ? `Auth account created for existing user`
            : `User already exists with the ${role} role`,
          roleAdded: false,
          alreadyExists: !authCreated,
          authCreated,
          tempPassword: authCreated ? tempPassword : undefined,
        }, requestOrigin);
      }

      const { error: roleErr } = await adminClient.from("user_roles").upsert({
        user_id: existingUserId,
        role,
      }, { onConflict: 'user_id,role' });

      if (roleErr) {
        console.error("Error adding role:", roleErr.message);
        return json(500, { error: "Failed to assign role" }, requestOrigin);
      }

      // Link student to parent if applicable
      if (role === "student") {
        await linkStudentToParent(adminClient, existingUserId, parentId, email, false);
      }

      await ensureUserContext(adminClient, existingUserId, branchId, body?.division_id ?? null, role);

      console.log(`Added role ${role} to existing user ${email}`);
      return json(200, {
        userId: existingUserId,
        email,
        role,
        message: `Role '${role}' added to existing user`,
        roleAdded: true,
      }, requestOrigin);
    }

    // Sibling creation (forceNewProfile)
    if (forceNewProfile) {
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ 
        page: 1, 
        perPage: 1000 
      });
      
      const existingAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);
      
      if (existingAuthUser) {
        const newProfileId = crypto.randomUUID();
        
        // Generate registration ID for sibling
        const registrationId = await generateRegId(adminClient, branchId, role);

        const { error: profileErr } = await adminClient.from("profiles").insert({
          id: newProfileId,
          email,
          full_name: fullName,
          whatsapp_number: whatsapp,
          gender: isValidGender(gender) ? gender : null,
          age: isValidAge(age) ? age : null,
          country,
          city,
          timezone: resolvedTimezone,
          registration_id: registrationId,
        });

        if (profileErr) {
          console.error("Error creating sibling profile:", profileErr.message);
          return json(500, { error: "Failed to create sibling profile" }, requestOrigin);
        }
        
        const { error: roleErr } = await adminClient.from("user_roles").upsert({
          user_id: newProfileId,
          role,
        }, { onConflict: 'user_id,role' });

        if (roleErr) {
          console.error("Error adding role to sibling profile:", roleErr.message);
          return json(500, { error: "Sibling profile created but role assignment failed" }, requestOrigin);
        }

        // Auto-link student sibling to parent
        if (role === "student") {
          await linkStudentToParent(adminClient, newProfileId, parentId, email, true);
        }

        await ensureUserContext(adminClient, newProfileId, branchId, body?.division_id ?? null, role);

        console.log(`Created sibling profile for ${fullName} (${email}) with role ${role}, profile ID: ${newProfileId}`);

        return json(200, {
          userId: newProfileId,
          email,
          full_name: fullName,
          role,
          registration_id: registrationId,
          whatsapp_number: whatsapp,
          gender,
          age,
          country,
          city,
          message: "Sibling profile created successfully (shares email with existing user)",
          roleAdded: false,
          isSiblingProfile: true,
        }, requestOrigin);
      }
    }

    // User doesn't exist - create new user
    // Auto-generate default password if none provided: FirstName1234 (title case)
    let finalPassword = password;
    if (!finalPassword) {
      const rawFirst = fullName.split(/\s+/)[0] || "User";
      const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
      finalPassword = firstName + "1234";
    }

    if (!isValidPassword(finalPassword)) {
      return json(400, { error: "Password must be 8-100 characters" }, requestOrigin);
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      if (createErr?.message?.includes("already been registered")) {
        console.log("User exists in auth but not in profiles, attempting to find and add role");
        
        const { data: authUsers } = await adminClient.auth.admin.listUsers({ 
          page: 1, 
          perPage: 1000 
        });
        
        const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);
        
        if (authUser) {
          const registrationId = await generateRegId(adminClient, branchId, role);

          const { error: profileUpsertErr } = await adminClient.from("profiles").upsert({
            id: authUser.id,
            email,
            full_name: fullName,
            whatsapp_number: whatsapp,
            gender: isValidGender(gender) ? gender : null,
            age: isValidAge(age) ? age : null,
            country,
            city,
            timezone: resolvedTimezone,
            registration_id: registrationId,
          }, { onConflict: "id" });

          if (profileUpsertErr) {
            console.error("Error upserting profile for existing auth user:", profileUpsertErr.message);
            return json(500, { error: "Failed to create/update profile" }, requestOrigin);
          }

          const { data: existingRole } = await adminClient
            .from("user_roles")
            .select("id")
            .eq("user_id", authUser.id)
            .eq("role", role)
            .maybeSingle();

          if (existingRole) {
            return json(200, {
              userId: authUser.id,
              email,
              role,
              registration_id: registrationId,
              message: `User already exists with the ${role} role`,
              roleAdded: false,
              alreadyExists: true,
            }, requestOrigin);
          }

          const { error: roleErr } = await adminClient.from("user_roles").upsert({
            user_id: authUser.id,
            role,
          }, { onConflict: 'user_id,role' });

          if (roleErr) {
            console.error("Error adding role to existing auth user:", roleErr.message);
            return json(500, { error: "Failed to assign role" }, requestOrigin);
          }

          if (role === "student") {
            await linkStudentToParent(adminClient, authUser.id, parentId, email, false);
          }

          await ensureUserContext(adminClient, authUser.id, branchId, body?.division_id ?? null, role);

          console.log(`Added role ${role} to existing auth user ${email}`);
          return json(200, {
            userId: authUser.id,
            email,
            role,
            registration_id: registrationId,
            message: `Role '${role}' added to existing user`,
            roleAdded: true,
          }, requestOrigin);
        }
      }
      
      console.error("Error creating user:", createErr?.message);
      return json(400, { error: createErr?.message || "Failed to create user account" }, requestOrigin);
    }

    const newUserId = created.user.id;

    // Generate registration ID
    const registrationId = await generateRegId(adminClient, branchId, role);

    const { error: profileErr } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        whatsapp_number: whatsapp,
        gender: isValidGender(gender) ? gender : null,
        age: isValidAge(age) ? age : null,
        country,
        city,
        timezone: resolvedTimezone,
        registration_id: registrationId,
      },
      { onConflict: "id" },
    );

    if (profileErr) {
      console.error("Error creating profile:", profileErr.message);
      return json(500, { error: "User created but profile setup failed" }, requestOrigin);
    }

    const { error: roleErr } = await adminClient.from("user_roles").upsert({
      user_id: newUserId,
      role,
    }, { onConflict: 'user_id,role' });

    if (roleErr) {
      console.error("Error adding role:", roleErr.message);
      return json(500, { error: "User created but role assignment failed" }, requestOrigin);
    }

    // Link student to parent if applicable
    if (role === "student") {
      await linkStudentToParent(adminClient, newUserId, parentId, email, forceNewProfile);
    }

    await ensureUserContext(adminClient, newUserId, branchId, body?.division_id ?? null, role);

    console.log(`Created new user ${email} with role ${role}, reg ID: ${registrationId}`);

    return json(200, {
      userId: newUserId,
      email,
      full_name: fullName,
      role,
      registration_id: registrationId,
      whatsapp_number: whatsapp,
      gender,
      age,
      country,
      city,
      message: "User created successfully",
      roleAdded: false,
    }, requestOrigin);
  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
