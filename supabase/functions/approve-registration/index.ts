/// <reference lib="deno.ns" />
import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tempPasswordFor(fullName: string) {
  const first = (fullName || "User").split(/\s+/)[0] || "User";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() + "1234";
}

type Admin = Awaited<ReturnType<typeof requireRole>> extends { adminClient: infer C } ? C : never;

async function findAuthUserByEmail(admin: any, email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = data?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
  return found?.id ?? null;
}

/** Create (or reuse) an auth user + profile + role. Returns the profile id. */
async function upsertUser(
  admin: any,
  opts: { email: string; fullName: string; role: string; profile: Record<string, unknown> },
): Promise<{ id: string; created: boolean; password: string }> {
  const email = opts.email.toLowerCase().trim();
  const password = tempPasswordFor(opts.fullName);
  let created = false;
  let userId: string | null = null;

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName },
  });

  if (authErr) {
    if (/already/i.test(authErr.message || "")) {
      userId = await findAuthUserByEmail(admin, email);
    }
    if (!userId) throw authErr;
  } else {
    userId = authData.user.id;
    created = true;
  }

  const payload: Record<string, unknown> = {
    id: userId,
    full_name: opts.fullName,
    email,
    ...opts.profile,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { error: pErr } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (pErr) throw pErr;

  await admin.from("user_roles").upsert(
    { user_id: userId, role: opts.role },
    { onConflict: "user_id,role" },
  );

  return { id: userId as string, created, password };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, [
      "super_admin",
      "admin",
      "admin_division",
      "admin_admissions",
    ]);
    if (!auth.ok) return json(auth.status, { error: auth.error });
    const admin = auth.adminClient as any;

    const { registration_id, review_notes } = await req.json();
    if (!registration_id) return json(400, { error: "registration_id is required" });

    const { data: reg, error: regErr } = await admin
      .from("family_registrations")
      .select("*")
      .eq("id", registration_id)
      .single();
    if (regErr || !reg) return json(404, { error: "Registration not found" });
    if (reg.status === "approved") return json(400, { error: "Already approved" });

    const applicant = (reg.applicant_data || {}) as Record<string, any>;
    const createdIds: string[] = [];
    const accounts: { name: string; email: string; password: string; role: string; created: boolean }[] = [];

    if (reg.registration_type === "teacher") {
      const email = (applicant.email || reg.email || "").toLowerCase().trim();
      if (!EMAIL_RE.test(email)) return json(400, { error: "Applicant has no valid email" });
      const banking = applicant.banking || {};
      const res = await upsertUser(admin, {
        email,
        fullName: applicant.full_name || reg.parent_name,
        role: "teacher",
        profile: {
          whatsapp_number: applicant.whatsapp || reg.phone,
          city: reg.city,
          country: reg.country,
          timezone: reg.timezone,
          address: reg.address,
          gender: ["male", "female"].includes((applicant.gender || "").toLowerCase())
            ? (applicant.gender || "").toLowerCase()
            : undefined,
          date_of_birth: applicant.date_of_birth || undefined,
          qualification: applicant.qualification || undefined,
          specialization: applicant.specialization || undefined,
          years_experience: applicant.years_experience ?? undefined,
          bank_name: banking.bank_name || undefined,
          bank_account_title: banking.bank_account_title || undefined,
          bank_account_number: banking.bank_account_number || undefined,
          bank_iban: banking.bank_iban || undefined,
          joining_date: new Date().toISOString().slice(0, 10),
          avatar_url: reg.avatar_url || undefined,
          account_status: "active",
        },
      });
      createdIds.push(res.id);
      accounts.push({
        name: applicant.full_name || reg.parent_name,
        email,
        password: res.password,
        role: "teacher",
        created: res.created,
      });
    } else {
      // Family / student registration: parent (if email valid) + each child
      let parentId: string | null = null;
      const parentEmail = (reg.email || "").toLowerCase().trim();
      const children = Array.isArray(reg.children) ? (reg.children as any[]) : [];
      const parentIsAlsoStudent = children.some(
        (c) => (c.email || "").toLowerCase().trim() === parentEmail,
      );

      if (EMAIL_RE.test(parentEmail) && !parentIsAlsoStudent) {
        const res = await upsertUser(admin, {
          email: parentEmail,
          fullName: reg.parent_name,
          role: "parent",
          profile: {
            whatsapp_number: reg.phone,
            city: reg.city,
            country: reg.country,
            timezone: reg.timezone,
            address: reg.address,
            preferred_contact_method: reg.preferred_contact || undefined,
            account_status: "active",
          },
        });
        parentId = res.id;
        createdIds.push(res.id);
        accounts.push({
          name: reg.parent_name,
          email: parentEmail,
          password: res.password,
          role: "parent",
          created: res.created,
        });
      }

      for (const child of children) {
        const childEmail = (child.email || "").toLowerCase().trim();
        if (!EMAIL_RE.test(childEmail)) continue;
        const res = await upsertUser(admin, {
          email: childEmail,
          fullName: child.name || child.full_name || "Student",
          role: "student",
          profile: {
            whatsapp_number: child.whatsapp || child.phone || undefined,
            city: reg.city,
            country: reg.country,
            timezone: reg.timezone,
            address: reg.address,
            date_of_birth: child.date_of_birth || undefined,
            gender: ["male", "female"].includes((child.gender || "").toLowerCase())
              ? (child.gender || "").toLowerCase()
              : undefined,
            school_name: child.school_name || undefined,
            grade_level: child.grade_level || undefined,
            learning_goals: child.goals || undefined,
            medical_conditions: child.medical_conditions || undefined,
            special_needs: child.special_needs || undefined,
            father_name: applicant.father_name || undefined,
            father_contact: applicant.father_phone || undefined,
            mother_name: applicant.mother_name || undefined,
            mother_contact: applicant.mother_phone || undefined,
            emergency_contact_name: applicant.emergency_name || undefined,
            emergency_contact_phone: applicant.emergency_phone || undefined,
            hear_about_us: applicant.hear_about || undefined,
            account_status: "active",
          },
        });
        createdIds.push(res.id);
        accounts.push({
          name: child.name || "Student",
          email: childEmail,
          password: res.password,
          role: "student",
          created: res.created,
        });

        if (parentId && parentId !== res.id) {
          await admin.from("student_parent_links").upsert(
            {
              student_id: res.id,
              parent_id: parentId,
              relationship: reg.relationship || "Parent",
              oversight_level: "full",
            },
            { onConflict: "student_id,parent_id" },
          );
        }
      }
    }

    if (!accounts.length) {
      return json(400, { error: "No valid email addresses found in this registration" });
    }

    await admin
      .from("family_registrations")
      .update({
        status: "approved",
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes || null,
        created_profile_ids: createdIds,
      })
      .eq("id", registration_id);

    return json(200, { success: true, accounts, created_profile_ids: createdIds });
  } catch (err: any) {
    console.error("approve-registration failed:", err?.message);
    return json(500, { error: err?.message || "Unexpected error" });
  }
});
