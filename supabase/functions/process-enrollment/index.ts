/// <reference lib="deno.ns" />
import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";
import { defaultPasswordFor } from "../_shared/default-password.ts";
import { loadIdentityConfig, normaliseRegistrationType } from "../_shared/org-identity.ts";
import { isValidEmail, resolvePerson } from "../_shared/identity.ts";


function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["super_admin", "admin", "admin_division"]);
    if (!auth.ok) return json(auth.status, { error: auth.error });
    const supabaseAdmin = auth.adminClient;

    const { submission_id, course_id } = await req.json();
    if (!submission_id || !course_id) {
      return json(400, { error: "submission_id and course_id are required" });
    }

    const failedSteps: string[] = [];
    let profileId: string | null = null;
    let authCreated = false;
    let classAssigned: string | null = null;
    let chatJoined = false;
    let enrollmentId: string | null = null;
    let tempPassword = "";
    let studentName = "";
    let loginEmail = "";

    // ── Fetch submission ──
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("registration_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) return json(404, { error: "Submission not found" });
    if (sub.status === "enrolled") return json(400, { error: "Already enrolled", already_enrolled: true });

    const d = (sub.data || {}) as Record<string, any>;
    const submittedEmail = (d.email || "").toLowerCase().trim();
    // A student's own email, when the registrant confirmed they have one.
    const ownStudentEmail = (d.student_email || "").toLowerCase().trim();
    const hasOwnEmail = d.student_has_own_email === true || d.student_has_own_email === "yes";
    const phone = (d.phone || d.whatsapp_number || "").trim();
    const fullName = d.full_name || submittedEmail.split("@")[0] || "Student";
    const city = d.city || null;
    const country = d.country || null;
    const rawGender = (d.gender || "").toLowerCase().trim();
    const gender = rawGender === "male" || rawGender === "female" ? rawGender : null;

    // ── Identity (gov_id) — supporting evidence, reviewed by a human ──
    const identity = (d.identity || {}) as Record<string, any>;
    const govIdType = identity.gov_id_type || null;
    const govIdNumberRaw = (identity.gov_id_number || "").trim();
    const govIdNumber = govIdNumberRaw || null;
    const govIdDocPath = identity.gov_id_doc_path || null;

    studentName = fullName;
    tempPassword = defaultPasswordFor(fullName);

    // ── Workflow: driven by the course's Registration Type ──
    const { data: courseRow } = await supabaseAdmin
      .from("courses")
      .select("registration_type")
      .eq("id", course_id)
      .maybeSingle();
    const workflow = normaliseRegistrationType(courseRow?.registration_type);
    const config = await loadIdentityConfig(supabaseAdmin);

    // Which email is the LOOKUP key for this person?
    //  - free       → the student's own email (mandatory)
    //  - paid / 1:1 → their own email if confirmed, otherwise an academy login
    const lookupEmail = ownStudentEmail || submittedEmail;
    const ownEmailConfirmed = workflow === "free" ? true : hasOwnEmail || Boolean(ownStudentEmail);

    if (workflow === "free" && !isValidEmail(lookupEmail)) {
      return json(400, { error: "Free course registration requires the student's own valid email address." });
    }

    // ── PRE-CHECK: gov_id duplicate detection (before any writes) ──
    // Never auto-merges — halts for admin review.
    if (govIdNumber) {
      const { data: govMatches } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, gov_id_verified")
        .ilike("gov_id_number", govIdNumber)
        .limit(2);

      const govMatch = govMatches?.[0];
      if (govMatch && (govMatch.email || "").toLowerCase() !== lookupEmail) {
        await supabaseAdmin.from("registration_submissions").update({
          status: "needs_review",
          match_status: "duplicate_gov_id",
          matched_profile_id: govMatch.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", submission_id);

        return json(409, {
          error: "duplicate_gov_id",
          message: "A profile with this government ID already exists. Admin review required to link or reject this submission.",
          requires_admin_review: true,
          existing_profile: {
            id: govMatch.id,
            full_name: govMatch.full_name,
            email: govMatch.email,
            verified: govMatch.gov_id_verified,
          },
          submitted_email: lookupEmail,
        });
      }
    }

    // ── STEPS 1-3: Resolve the permanent user id (profile + auth + role) ──
    const resolved = await resolvePerson(supabaseAdmin, {
      submittedEmail: lookupEmail,
      fullName,
      phone,
      role: "student",
      workflow,
      ownEmailConfirmed,
      config,
      password: tempPassword,
      profile: {
        city,
        country,
        gender,
        gov_id_type: govIdType || undefined,
        gov_id_number: govIdNumber || undefined,
        gov_id_doc_url: govIdDocPath || undefined,
        gov_id_verified: govIdNumber ? false : undefined,
      },
    });

    if (!resolved.ok) {
      await supabaseAdmin.from("registration_submissions").update({
        status: "needs_review",
        match_status: resolved.code,
        reviewed_at: new Date().toISOString(),
      }).eq("id", submission_id);
      return json(resolved.status, { error: resolved.error, code: resolved.code, requires_admin_review: true });
    }

    profileId = resolved.profileId;
    loginEmail = resolved.loginEmail;
    tempPassword = resolved.password;
    authCreated = resolved.authCreated;


    // ── STEP 4: Create Course Enrollment ──
    try {
      const { data: existingEnroll } = await supabaseAdmin
        .from("course_enrollments")
        .select("id")
        .eq("course_id", course_id)
        .eq("student_id", profileId)
        .limit(1);

      if (existingEnroll?.length) {
        enrollmentId = existingEnroll[0].id;
      } else {
        const { data: newEnroll, error: enrollErr } = await supabaseAdmin
          .from("course_enrollments")
          .insert({
            course_id,
            student_id: profileId,
            status: "active",
            enrolled_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (enrollErr) throw enrollErr;
        enrollmentId = newEnroll.id;
      }
    } catch (e: any) {
      failedSteps.push(`Step 4 (Enrollment): ${e.message}`);
      console.error("Step 4 failed:", e.message);
    }

    // ── STEP 5: Assign to Class ──
    try {
      // Find active class with available seats
      const { data: classes } = await supabaseAdmin
        .from("course_classes")
        .select("id, name, max_seats")
        .eq("course_id", course_id)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (classes?.length) {
        let assignedClass = null;
        for (const cls of classes) {
          const { count } = await supabaseAdmin
            .from("course_class_students")
            .select("id", { count: "exact", head: true })
            .eq("class_id", cls.id);
          if ((count || 0) < cls.max_seats) {
            assignedClass = cls;
            break;
          }
        }

        if (assignedClass) {
          // Check if already rostered
          const { data: existingRoster } = await supabaseAdmin
            .from("course_class_students")
            .select("id")
            .eq("class_id", assignedClass.id)
            .eq("student_id", profileId)
            .limit(1);

          if (!existingRoster?.length) {
            await supabaseAdmin.from("course_class_students").insert({
              class_id: assignedClass.id,
              student_id: profileId,
              status: "active",
            });
          }
          classAssigned = assignedClass.name;
        }
      }
    } catch (e: any) {
      failedSteps.push(`Step 5 (Class): ${e.message}`);
      console.error("Step 5 failed:", e.message);
    }

    // ── STEP 6: Chat Group Membership (per-class) ──
    try {
      // Find the class the student was just rostered into
      const { data: rosterRow } = await supabaseAdmin
        .from("course_class_students")
        .select("class_id")
        .eq("student_id", profileId)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false })
        .limit(1);

      const classIdForChat = rosterRow?.[0]?.class_id || null;

      if (classIdForChat) {
        // Find existing class chat group
        const { data: existingGroup } = await supabaseAdmin
          .from("chat_groups")
          .select("id")
          .eq("class_id", classIdForChat)
          .limit(1);

        let groupId: string | null = existingGroup?.[0]?.id || null;

        // Create class chat group if missing
        if (!groupId) {
          const { data: cls } = await supabaseAdmin
            .from("course_classes")
            .select("name")
            .eq("id", classIdForChat)
            .single();

          const { data: newGroup, error: grpErr } = await supabaseAdmin
            .from("chat_groups")
            .insert({
              name: (cls?.name || "Class") + " — Class Chat",
              type: "group",
              created_by: profileId,
              course_id,
              class_id: classIdForChat,
              channel_mode: "class",
              is_active: true,
              is_dm: false,
            })
            .select("id")
            .single();
          if (!grpErr && newGroup) groupId = newGroup.id;
        }

        if (groupId) {
          const { data: existingMember } = await supabaseAdmin
            .from("chat_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", profileId)
            .limit(1);

          if (!existingMember?.length) {
            await supabaseAdmin.from("chat_members").insert({
              group_id: groupId,
              user_id: profileId,
              role: "member",
            });
          }
          chatJoined = true;
        }
      }
    } catch (e: any) {
      failedSteps.push(`Step 6 (Chat): ${e.message}`);
      console.error("Step 6 failed:", e.message);
    }

    // ── STEP 7: Update Submission Status ──
    try {
      await supabaseAdmin.from("registration_submissions").update({
        status: "enrolled",
        enrollment_id: enrollmentId,
        processed_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        matched_profile_id: profileId,
      }).eq("id", submission_id);
    } catch (e: any) {
      failedSteps.push(`Step 7 (Submission Update): ${e.message}`);
      console.error("Step 7 failed:", e.message);
    }

    // ── STEP 8: Return Summary ──
    return json(200, {
      success: true,
      profile_id: profileId,
      auth_created: authCreated,
      class_assigned: classAssigned,
      chat_joined: chatJoined,
      login_email: loginEmail,
      temp_password: tempPassword,
      enrollment_id: enrollmentId,
      student_name: studentName,
      matched_existing: !authCreated && failedSteps.length === 0,
      message: failedSteps.length === 0
        ? "Student fully onboarded"
        : "Partially onboarded — some steps failed",
      failed_steps: failedSteps.length > 0 ? failedSteps : undefined,
    });
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    return json(500, { error: err.message });
  }
});
