// Bulk identity migration runner. Processes one row of the migration CSV per request.
// Body: { row: <object>, dryRun?: boolean }
// Returns: { success, actions: [...], errors: [...] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Row {
  profile_id: string;
  student_name: string;
  current_email: string;
  phone: string;
  gender: string;
  age: string;
  country: string;
  city: string;
  teacher_name: string;
  assignment_id: string;
  subject: string;
  assignment_status: string;
  new_student_email: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  action: string;
  consolidate_to_profile_id: string;
  new_student_password: string;
  migration_notes: string;
}

function firstWord(s: string) {
  return (s || "").trim().split(/\s+/)[0] || "Parent";
}

async function logAction(admin: any, action: string, entity_id: string | null, details: any) {
  await admin.from("system_logs").insert({
    action,
    entity_type: "migration",
    entity_id,
    details,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    const { row, dryRun } = await req.json() as { row: Row; dryRun?: boolean };
    if (!row || !row.profile_id) {
      return new Response(JSON.stringify({ error: "Missing row.profile_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = (row.action || "").trim().toUpperCase();
    const parts = new Set(action.split("|").map((p) => p.trim()).filter(Boolean));

    if (parts.has("NO_CHANGE") || parts.size === 0) {
      await logAction(admin, "migration_skip", row.profile_id, { row, reason: "NO_CHANGE" });
      return new Response(JSON.stringify({ success: true, actions: ["NO_CHANGE"], errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        actions: [`DRY_RUN: would process ${[...parts].join("|")}`],
        errors: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ 1) CONSOLIDATE_PROFILE ============
    // Reassign all assignments from orphan profile_id to consolidate_to_profile_id, soft-delete orphan.
    if (parts.has("CONSOLIDATE_PROFILE")) {
      const target = row.consolidate_to_profile_id?.trim();
      if (!target) {
        errors.push("CONSOLIDATE_PROFILE: missing consolidate_to_profile_id");
      } else if (target === row.profile_id) {
        // Self-consolidate: this row's profile_id IS the keeper. Nothing to do here.
        actions.push("CONSOLIDATE_PROFILE_SELF: keeper profile, no reassign");
      } else {
        // Reassign all assignments
        const { error: e1, count: c1 } = await admin
          .from("student_teacher_assignments")
          .update({ student_id: target }, { count: "exact" })
          .eq("student_id", row.profile_id);
        if (e1) errors.push(`reassign assignments: ${e1.message}`);
        else actions.push(`reassigned ${c1 ?? 0} assignments → ${target}`);

        // Reassign class roster, parent links, attendance, etc. (best-effort, ignore missing tables)
        const tables: { table: string; col: string }[] = [
          { table: "course_class_students", col: "student_id" },
          { table: "course_enrollments", col: "student_id" },
          { table: "student_parent_links", col: "student_id" },
          { table: "attendance", col: "student_id" },
          { table: "registration_submissions", col: "matched_profile_id" },
        ];
        for (const t of tables) {
          const { error, count } = await admin
            .from(t.table)
            .update({ [t.col]: target }, { count: "exact" })
            .eq(t.col, row.profile_id);
          if (error) errors.push(`reassign ${t.table}: ${error.message}`);
          else if (count && count > 0) actions.push(`reassigned ${count} ${t.table}`);
        }

        // Soft-delete orphan
        const { error: eArch } = await admin
          .from("profiles")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", row.profile_id);
        if (eArch) errors.push(`archive orphan: ${eArch.message}`);
        else actions.push(`archived orphan profile ${row.profile_id}`);
      }
      await logAction(admin, "migration_consolidate", row.profile_id, { row, actions, errors });
    }

    // The "operating" profile id for subsequent steps is the keeper if consolidated, else self.
    const operatingProfileId = (parts.has("CONSOLIDATE_PROFILE") && row.consolidate_to_profile_id?.trim())
      ? row.consolidate_to_profile_id.trim()
      : row.profile_id;

    // ============ 2) UPDATE_EMAIL (or UPDATE_EMAIL_ONLY) ============
    if (parts.has("UPDATE_EMAIL_ONLY") || parts.has("UPDATE_EMAIL")) {
      const newEmail = row.new_student_email?.trim().toLowerCase();
      if (!newEmail) {
        errors.push("UPDATE_EMAIL: missing new_student_email");
      } else {
        // Update profiles.email
        const { error: eP } = await admin
          .from("profiles")
          .update({ email: newEmail })
          .eq("id", operatingProfileId);
        if (eP) errors.push(`profiles.email update: ${eP.message}`);
        else actions.push(`profiles.email → ${newEmail}`);

        // Update auth user (email + password if provided)
        const updatePayload: any = { email: newEmail, email_confirm: true };
        if (row.new_student_password?.trim()) updatePayload.password = row.new_student_password.trim();
        const { error: eA } = await admin.auth.admin.updateUserById(operatingProfileId, updatePayload);
        if (eA) errors.push(`auth update: ${eA.message}`);
        else actions.push(`auth.email updated${updatePayload.password ? " + password set" : ""}`);
      }
      await logAction(admin, "migration_update_email", operatingProfileId, { row, actions, errors });
    }

    // ============ 3) CREATE_PARENT (or CREATE_PARENT_ONLY / PARENT_ACCOUNT_ONLY) ============
    if (parts.has("CREATE_PARENT") || parts.has("CREATE_PARENT_ONLY") || parts.has("PARENT_ACCOUNT_ONLY")) {
      // Determine parent email source
      const parentEmail = (row.parent_email?.trim() || row.current_email?.trim() || "").toLowerCase();
      const parentName = row.parent_name?.trim() || `Parent of ${row.student_name}`;
      if (!parentEmail) {
        errors.push("CREATE_PARENT: no parent_email or current_email available");
      } else {
        // Find existing parent profile by email
        const { data: existing } = await admin
          .from("profiles")
          .select("id")
          .ilike("email", parentEmail)
          .maybeSingle();

        let parentId: string | null = existing?.id ?? null;

        if (!parentId) {
          // Create auth user
          const tempPassword = `${firstWord(parentName)}@AQT2025`;
          const { data: created, error: eAuth } = await admin.auth.admin.createUser({
            email: parentEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: parentName,
              force_password_reset: true,
              created_via: "identity_migration",
            },
          });
          if (eAuth || !created?.user) {
            errors.push(`create parent auth: ${eAuth?.message || "no user"}`);
          } else {
            parentId = created.user.id;
            // Create profile row (in case trigger didn't)
            const { error: eProf } = await admin.from("profiles").upsert({
              id: parentId,
              email: parentEmail,
              full_name: parentName,
              whatsapp_number: row.parent_phone?.trim() || null,
              country: row.country?.trim() || null,
            }, { onConflict: "id" });
            if (eProf) errors.push(`parent profile upsert: ${eProf.message}`);

            // Assign parent role
            const { error: eRole } = await admin.from("user_roles").insert({
              user_id: parentId,
              role: "parent",
            });
            if (eRole && !eRole.message.includes("duplicate")) {
              errors.push(`parent role: ${eRole.message}`);
            }
            actions.push(`created parent ${parentEmail} (temp password: ${tempPassword})`);
          }
        } else {
          actions.push(`parent ${parentEmail} already exists → ${parentId}`);
          // Ensure parent role
          await admin.from("user_roles").insert({ user_id: parentId, role: "parent" }).select();
        }

        // Link parent → student (only if not PARENT_ACCOUNT_ONLY-only with no student link needed)
        if (parentId && !parts.has("PARENT_ACCOUNT_ONLY")) {
          const { error: eLink } = await admin
            .from("student_parent_links")
            .upsert({ student_id: operatingProfileId, parent_id: parentId },
              { onConflict: "student_id,parent_id" });
          if (eLink) errors.push(`student_parent_link: ${eLink.message}`);
          else actions.push(`linked parent ${parentId} ↔ student ${operatingProfileId}`);
        }
      }
      await logAction(admin, "migration_create_parent", operatingProfileId, { row, actions, errors });
    }

    // ============ 4) MIGRATE_ASSIGNMENT ============
    if (parts.has("MIGRATE_ASSIGNMENT")) {
      const target = row.consolidate_to_profile_id?.trim();
      if (!target || !row.assignment_id) {
        errors.push("MIGRATE_ASSIGNMENT: missing consolidate_to_profile_id or assignment_id");
      } else {
        const { error } = await admin
          .from("student_teacher_assignments")
          .update({ student_id: target })
          .eq("id", row.assignment_id);
        if (error) errors.push(`migrate assignment: ${error.message}`);
        else actions.push(`assignment ${row.assignment_id} → student ${target}`);
      }
      await logAction(admin, "migration_migrate_assignment", row.assignment_id, { row, actions, errors });
    }

    // ============ 5) DEACTIVATE_ASSIGNMENT ============
    if (parts.has("DEACTIVATE_ASSIGNMENT")) {
      if (!row.assignment_id) {
        errors.push("DEACTIVATE_ASSIGNMENT: missing assignment_id");
      } else {
        // Enum has no 'inactive' — use 'left' which represents discontinued.
        const { error } = await admin
          .from("student_teacher_assignments")
          .update({ status: "left", status_effective_date: new Date().toISOString().slice(0, 10) })
          .eq("id", row.assignment_id);
        if (error) errors.push(`deactivate: ${error.message}`);
        else actions.push(`assignment ${row.assignment_id} → status=left (deactivated_migration)`);
      }
      await logAction(admin, "migration_deactivate_assignment", row.assignment_id, {
        row, actions, errors, note: "deactivated_migration",
      });
    }

    // KEEP_HISTORICAL: explicit no-op flag
    if (parts.has("KEEP_HISTORICAL") && !parts.has("MIGRATE_ASSIGNMENT") && !parts.has("PARENT_ACCOUNT_ONLY")) {
      actions.push("KEEP_HISTORICAL: no change");
    }

    return new Response(JSON.stringify({
      success: errors.length === 0,
      actions,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message, actions, errors }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
