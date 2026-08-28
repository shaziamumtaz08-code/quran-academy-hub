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
        if (displayEmail) u.searchParams.set("uemail", displayEmail);
        return u.toString();
      } catch {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}uname=${encodeURIComponent(displayName)}`;
      }
    };

    // The Zoom desktop app ignores `uname` and shows whatever name the device
    // profile carries (a shared family laptop then shows the teacher's name for
    // the student). Routing non-hosts through the Zoom WEB client makes the LMS
    // name authoritative, so attendance logs carry the right participant.
    const toWebClient = (url: string): string => {
      try {
        const u = new URL(url);
        const m = /\/j\/(\d+)/.exec(u.pathname);
        if (!m) return appendUname(url);
        const web = new URL(`${u.origin}/wc/${m[1]}/join`);
        const pwd = u.searchParams.get("pwd");
        if (pwd) web.searchParams.set("pwd", pwd);
        web.searchParams.set("uname", displayName);
        // Zoom's web client also reads a base64 name in `un`.
        try {
          web.searchParams.set("un", btoa(unescape(encodeURIComponent(displayName))));
        } catch { /* ignore */ }
        if (displayEmail) web.searchParams.set("uemail", displayEmail);
        // IMPORTANT: do NOT set prefer=1 — that hands the join to the installed
        // Zoom desktop/mobile app, which then uses the DEVICE profile name
        // (e.g. the teacher's own Zoom name on a shared phone) instead of the
        // LMS name. Staying in the browser keeps the LMS name authoritative.
        web.searchParams.set("prefer", "0");
        return web.toString();
      } catch {
        return appendUname(url);
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
        .select("division_id, divisions:division_id(model_type)")
        .eq("id", p.assignmentId)
        .maybeSingle();
      const model = (asg as any)?.divisions?.model_type;
      if (model === "group") preferredTier = "licensed";
    }
    const { data: dedicatedAccountRows } = await service
      .from("zoom_accounts")
      .select("id, zoom_account_email, zoom_user_id, tier, meeting_link, meeting_passcode, is_active")
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
      // Zoom only skips the passcode prompt when the link carries its long
      // ENCRYPTED pwd token. Links saved with a plain passcode (e.g. ?pwd=3333)
      // still prompt, so surface the passcode to the joiner.
      const rawPwd = (() => {
        const m = /[?&]pwd=([^&]+)/.exec(dedicatedAccount.meeting_link);
        return m ? decodeURIComponent(m[1]) : null;
      })();
      const passcode =
        (dedicatedAccount.meeting_passcode && String(dedicatedAccount.meeting_passcode).trim()) ||
        (rawPwd && rawPwd.length < 20 ? rawPwd : null);

      return jsonResp({
        ready: true,
        sessionId: session.id,
        licenseId: null,
        zoomAccountId: dedicatedAccount.id,
        passcode,
        joinUrl: isTeacher
          ? appendUname(dedicatedAccount.meeting_link)
          : toWebClient(dedicatedAccount.meeting_link),
        joinName: displayName,

      });
    }

    // DEDICATED-ONLY POLICY — the shared pool (Room 1/Room 2, owner account)
    // is fully bypassed. No dedicated link = no join, for everyone.
    const dedicatedMissingMsg = dedicatedAccount
      ? "This teacher's dedicated Zoom account has no meeting link saved. Add it in Zoom Control Room."
      : "No dedicated Zoom account is linked to this teacher. Ask an admin to link one in Zoom Control Room.";

    return jsonResp({
      ready: false,
      sessionId: session.id,
      message: isTeacher || isAdmin ? dedicatedMissingMsg : "Class room is not ready yet. Please wait for your teacher.",
    });
  } catch (e) {
    return jsonResp({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
