import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  teacherId: string;
  studentId?: string | null;
  assignmentId?: string | null;
  scheduleId?: string | null;
  scheduledStart?: string | null;
  liveSessionId?: string | null;
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
      "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceRoleKey);

    // Verify the bearer token explicitly — getUser() without an argument can
    // fall back to (absent) stored session state and 401 a valid caller.
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("auth.getUser failed", userErr?.message);
      return jsonResp({ error: "Unauthorized", detail: userErr?.message || "No user for token" }, 401);
    }
    const userId = userData.user.id;


    const p = (await req.json()) as Payload;
    if (!p.teacherId) return jsonResp({ error: "teacherId required" }, 400);

    // Fetch the joining user's registered LMS display name so Zoom shows the
    // correct participant name natively (fixes host/owner + SHAZIA vs Shazia Mumtaz).
    const { data: joinerProfile } = await service
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const displayName =
      (joinerProfile?.full_name && String(joinerProfile.full_name).trim()) ||
      (joinerProfile?.email && String(joinerProfile.email).split("@")[0]) ||
      "AQTA User";
    const displayEmail = joinerProfile?.email ? String(joinerProfile.email).trim() : null;

    const appendUname = (url: string): string => {
      try {
        const u = new URL(url);
        u.searchParams.set("uname", displayName);
        return u.toString();
      } catch {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}uname=${encodeURIComponent(displayName)}`;
      }
    };

    // Determine role
    const { data: roleRows } = await service.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isTeacher = userId === p.teacherId && roles.includes("teacher");
    const isStudent = roles.includes("student");
    const isParent = roles.includes("parent");
    const isAdmin = roles.includes("admin") || roles.includes("super_admin") || roles.includes("admin_academic") || roles.includes("admin_division");

    if (!isTeacher && !isStudent && !isParent && !isAdmin) {
      return jsonResp({ error: "Not permitted" }, 403);
    }


    // Guard: student must own the assignment
    if (isStudent && !isAdmin && p.assignmentId) {
      const { data: a } = await service
        .from("student_teacher_assignments")
        .select("student_id, teacher_id, status")
        .eq("id", p.assignmentId)
        .maybeSingle();
      if (!a || a.student_id !== userId || a.status !== "active" || a.teacher_id !== p.teacherId) {
        return jsonResp({ error: "Assignment not valid for you" }, 403);
      }
    }

    // NEW: prefer the teacher's dedicated Zoom account. Pick tier based on
    // divisional model when available (Group Academy → licensed, else free).
    let preferredTier: "free" | "licensed" = "free";
    if (p.assignmentId) {
      const { data: asg } = await service
        .from("student_teacher_assignments")
        .select("division_id, divisions:division_id(model)")
        .eq("id", p.assignmentId)
        .maybeSingle();
      const model = (asg as any)?.divisions?.model;
      if (model === "group") preferredTier = "licensed";
    }
    const { data: dedicatedAccountRows } = await service
      .from("zoom_accounts")
      .select("id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active")
      .eq("teacher_id", p.teacherId)
      .eq("is_active", true);
    const activeAccounts = (dedicatedAccountRows || []) as any[];
    const dedicatedAccount =
      activeAccounts.find((a) => a.tier === preferredTier) ||
      activeAccounts[0] ||
      null;

    // Locate or create the live_sessions row.
    let session: any = null;

    if (p.liveSessionId) {
      const { data } = await service
        .from("live_sessions")
        .select("id, status, license_id, zoom_account_id, teacher_id, student_id, assignment_id, scheduled_start")
        .eq("id", p.liveSessionId)
        .maybeSingle();
      session = data;
    }

    if (!session && p.assignmentId) {
      const { data } = await service
        .from("live_sessions")
        .select("id, status, license_id, zoom_account_id, teacher_id, student_id, assignment_id, scheduled_start")
        .eq("assignment_id", p.assignmentId)
        .in("status", ["scheduled", "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = data;
    }

    if (!session) {
      const { data: created, error: createErr } = await service
        .from("live_sessions")
        .insert({
          teacher_id: p.teacherId,
          student_id: isStudent ? userId : (p.studentId || null),
          assignment_id: p.assignmentId || null,
          schedule_id: p.scheduleId || null,
          scheduled_start: p.scheduledStart || new Date().toISOString(),
          status: "scheduled",
          zoom_account_id: dedicatedAccount?.id || null,
        })
        .select("id, status, license_id, zoom_account_id, teacher_id, student_id, assignment_id, scheduled_start")
        .single();
      if (createErr || !created) {
        return jsonResp({ error: createErr?.message || "Could not create session" }, 500);
      }
      session = created;
    }

    // Ensure student_id set for 1:1 sessions when a student is joining
    if (isStudent && !session.student_id) {
      await service.from("live_sessions").update({ student_id: userId }).eq("id", session.id);
      session.student_id = userId;
    }

    // DEDICATED ACCOUNT PATH — skip the shared pool entirely.
    if (dedicatedAccount && dedicatedAccount.meeting_link) {
      if (!session.zoom_account_id) {
        await service
          .from("live_sessions")
          .update({ zoom_account_id: dedicatedAccount.id })
          .eq("id", session.id);
      }
      return jsonResp({
        ready: true,
        sessionId: session.id,
        licenseId: null,
        zoomAccountId: dedicatedAccount.id,
        joinUrl: appendUname(dedicatedAccount.meeting_link),
      });
    }

    // POOLED FALLBACK — legacy path: allocate from Room 1/Room 2 pool.
    if (!session.license_id) {
      if (!(isTeacher || isAdmin)) {
        return jsonResp({
          ready: false,
          sessionId: session.id,
          message: "Waiting for teacher to open the class room.",
        });
      }

      const { data: reserved, error: rpcErr } = await service.rpc("get_and_reserve_license", {
        _teacher_id: p.teacherId,
        _session_id: session.id,
      });
      if (rpcErr || !reserved || (Array.isArray(reserved) && reserved.length === 0)) {
        return jsonResp({
          ready: false,
          sessionId: session.id,
          message: rpcErr?.message || "No Zoom room available. Ask an admin to link a dedicated Zoom account for this teacher in Zoom Control Room.",
        });
      }
      const row = Array.isArray(reserved) ? reserved[0] : reserved;
      return jsonResp({
        ready: true,
        sessionId: session.id,
        licenseId: row.license_id || null,
        joinUrl: appendUname(row.meeting_link),
      });
    }

    const { data: license } = await service
      .from("zoom_licenses")
      .select("meeting_link")
      .eq("id", session.license_id)
      .maybeSingle();
    if (!license?.meeting_link) {
      return jsonResp({
        ready: false,
        sessionId: session.id,
        message: "Meeting link not available yet.",
      });
    }
    return jsonResp({
      ready: true,
      sessionId: session.id,
      licenseId: session.license_id || null,
      joinUrl: appendUname(license.meeting_link),
    });
  } catch (e) {
    return jsonResp({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
