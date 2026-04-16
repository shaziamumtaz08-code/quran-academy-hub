/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    const email = (d.email || "").toLowerCase().trim();
    const phone = (d.phone || d.whatsapp_number || "").trim();
    const fullName = d.full_name || email.split("@")[0] || "Student";
    const city = d.city || null;
    const country = d.country || null;
    const rawGender = (d.gender || "").toLowerCase().trim();
    const gender = rawGender === "male" || rawGender === "female" ? rawGender : null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return json(400, { error: "A valid email address is required before enrollment." });
    }

    studentName = fullName;
    loginEmail = email;
    const firstName = (fullName.split(/\s+/)[0] || "User");
    tempPassword = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() + "1234";

    // ── STEP 1: Create / Find Profile ──
    try {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .limit(1);

      if (existing?.length) {
        profileId = existing[0].id;
      } else {
        const newId = crypto.randomUUID();
        const { error: insErr } = await supabaseAdmin.from("profiles").insert({
          id: newId,
          full_name: fullName,
          email,
          whatsapp_number: phone || null,
          city,
          country,
          gender,
        });
        if (insErr) throw insErr;
        profileId = newId;
      }
    } catch (e: any) {
      failedSteps.push(`Step 1 (Profile): ${e.message}`);
      console.error("Step 1 failed:", e.message);
    }

    if (!profileId) {
      return json(500, { error: "Cannot proceed without profile", failed_steps: failedSteps });
    }

    // ── STEP 2: Create Auth Account ──
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr) {
        if (authErr.message?.includes("already been registered") || authErr.message?.includes("already exists")) {
          // Auth exists — find via listUsers (getUserByEmail not available in this SDK version)
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existingAuth = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
          if (existingAuth) {
            const authUid = existingAuth.id;
            if (authUid !== profileId) {
              console.log(`Syncing profile ${profileId} → auth uid ${authUid}`);
              await supabaseAdmin.from("profiles").update({ id: authUid }).eq("id", profileId);
              profileId = authUid;
            }
          }
          authCreated = false;
        } else {
          throw authErr;
        }
      } else {
        authCreated = true;
        // Sync profile id to match auth user id for RLS
        if (authData?.user && authData.user.id !== profileId) {
          const authUid = authData.user.id;
          console.log(`Syncing new profile ${profileId} → auth uid ${authUid}`);
          await supabaseAdmin.from("profiles").update({ id: authUid }).eq("id", profileId);
          profileId = authUid;
        }
      }
    } catch (e: any) {
      failedSteps.push(`Step 2 (Auth): ${e.message}`);
      console.error("Step 2 failed:", e.message);
    }

    // ── STEP 3: Assign Student Role ──
    try {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: profileId, role: "student" },
        { onConflict: "user_id,role" }
      );
    } catch (e: any) {
      failedSteps.push(`Step 3 (Role): ${e.message}`);
      console.error("Step 3 failed:", e.message);
    }

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
