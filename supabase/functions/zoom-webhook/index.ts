import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp",
};

interface ZoomEvent {
  event: string;
  payload: {
    plainToken?: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic?: string;
      start_time?: string;
      end_time?: string;
      duration?: number;
      password?: string;
      recording_files?: Array<{
        id: string;
        meeting_id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_size: number;
        play_url: string;
        download_url: string;
        recording_type: string;
        status: string;
      }>;
      participant?: {
        user_id: string;
        user_name: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
  event_ts: number;
}

function verifyZoomSignature(
  signature: string,
  timestamp: string,
  body: string,
  secretToken: string
): boolean {
  const message = `v0:${timestamp}:${body}`;
  const hashForVerify = createHmac("sha256", secretToken)
    .update(message)
    .digest("hex");
  const expectedSignature = `v0=${hashForVerify}`;
  return signature === expectedSignature;
}

// Helper: get the current day of week as lowercase string
function getTodayDayOfWeek(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getDay()];
}

// Helper: find the student scheduled with a teacher right now
async function findScheduledStudent(supabase: any, teacherId: string): Promise<string | null> {
  const today = getTodayDayOfWeek();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Get active assignments for this teacher
  const { data: assignments } = await supabase
    .from("student_teacher_assignments")
    .select("id, student_id")
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  if (!assignments || assignments.length === 0) return null;

  const assignmentIds = assignments.map((a: any) => a.id);

  // Find a schedule for today within ±15 minutes
  const { data: resolvedSchedules } = await supabase
    .rpc("get_effective_schedule_periods", { _on_date: todayIso });
  const schedules = (resolvedSchedules || []).filter((schedule: any) => assignmentIds.includes(schedule.assignment_id));

  if (!schedules || schedules.length === 0) return null;

  for (const sched of schedules) {
    const [h, m] = (sched.student_local_time || "00:00").split(":").map(Number);
    const schedMinutes = h * 60 + m;
    const diff = Math.abs(nowMinutes - schedMinutes);
    // Within ±60 minutes window (generous for class duration)
    if (diff <= 60) {
      const assignment = assignments.find((a: any) => a.id === sched.assignment_id);
      if (assignment) return assignment.student_id;
    }
  }

  // If only one student assigned, return them as fallback
  if (assignments.length === 1) return assignments[0].student_id;

  return null;
}

function eventTime(event: ZoomEvent, fallback = new Date()): string {
  if (event.event_ts) {
    return new Date(event.event_ts).toISOString();
  }
  return fallback.toISOString();
}

function normalizeParticipantValue(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function sameParticipant(log: any, participantName: string, participantEmail: string): boolean {
  const logEmail = normalizeParticipantValue(log.participant_email);
  const currentEmail = normalizeParticipantValue(participantEmail);
  if (logEmail && currentEmail && logEmail === currentEmail) return true;

  const logName = normalizeParticipantValue(log.participant_name);
  const currentName = normalizeParticipantValue(participantName);
  return Boolean(logName && currentName && logName === currentName);
}

function isAccountEmail(participantEmail: string, hostEmail?: string | null): boolean {
  const currentEmail = normalizeParticipantValue(participantEmail);
  const normalizedHostEmail = normalizeParticipantValue(hostEmail);
  return Boolean(currentEmail && normalizedHostEmail && currentEmail === normalizedHostEmail);
}

function isHostParticipant(
  participantName: string,
  participantEmail: string,
  hostEmail?: string | null,
  hostName?: string | null,
  participantZoomUserId?: string | null,
  meetingHostId?: string | null,
): boolean {
  const participantId = normalizeParticipantValue(participantZoomUserId);
  const hostId = normalizeParticipantValue(meetingHostId);
  if (participantId && hostId) return participantId === hostId;

  // Zoom reports the *account owner's* email for every guest who joins without
  // signing in, so "email == account email" alone is NOT proof of being the host.
  // Treat the participant as the host only when the display name also matches the
  // Zoom account / host name — otherwise real students were being logged as "host"
  // with no profile match at all.
  if (!isAccountEmail(participantEmail, hostEmail)) return false;
  const currentName = normalizeParticipantValue(participantName);
  if (!currentName) return true;
  const normalizedHostName = normalizeParticipantValue(hostName);
  if (normalizedHostName && currentName === normalizedHostName) return true;
  const accountLocalPart = normalizeParticipantValue((hostEmail || "").split("@")[0]);
  return Boolean(accountLocalPart && currentName === accountLocalPart);
}

function participantMatchesProfile(
  participantName: string,
  participantEmail: string,
  profile?: { full_name?: string | null; email?: string | null } | null,
): boolean {
  if (!profile) return false;
  const currentEmail = normalizeParticipantValue(participantEmail);
  const profileEmail = normalizeParticipantValue(profile.email);
  if (currentEmail && profileEmail && currentEmail === profileEmail) return true;

  const currentName = normalizeParticipantValue(participantName);
  const profileName = normalizeParticipantValue(profile.full_name);
  return Boolean(currentName && profileName && currentName === profileName);
}

async function resolveParticipantIdentity(
  supabase: any,
  session: any,
  participantName: string,
  participantEmail: string,
  hostEmail?: string | null,
  hostName?: string | null,
  participantZoomUserId?: string | null,
  meetingHostId?: string | null,
): Promise<{ matchedUserId: string | null; matchedRole: string }> {
  if (isHostParticipant(
    participantName,
    participantEmail,
    hostEmail,
    hostName,
    participantZoomUserId,
    meetingHostId,
  )) {
    return { matchedUserId: null, matchedRole: "host" };
  }

  // The account email is a Zoom artefact for guests — never use it for identity.
  const usableEmail = isAccountEmail(participantEmail, hostEmail) ? "" : participantEmail;

  if (usableEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", usableEmail)
      .maybeSingle();

    if (profile?.id) {
      if (profile.id === session.teacher_id) return { matchedUserId: profile.id, matchedRole: "teacher" };
      if (profile.id === session.student_id) return { matchedUserId: profile.id, matchedRole: "student" };

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id);
      const roles = (roleRows || []).map((row: any) => row.role);
      if (roles.includes("teacher")) return { matchedUserId: profile.id, matchedRole: "teacher" };
      if (roles.includes("student")) return { matchedUserId: profile.id, matchedRole: "student" };
      return { matchedUserId: profile.id, matchedRole: roles[0] || "unknown" };
    }
  }

  // Exact display-name match — this is how unauthenticated students (who join with
  // their LMS name appended to the link) get attributed to their profile.
  if (participantName && participantName.toLowerCase() !== "unknown") {
    const { data: nameMatches } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("full_name", participantName)
      .limit(2);

    if (nameMatches?.length === 1) {
      const profile = nameMatches[0];
      if (profile.id === session.teacher_id) return { matchedUserId: profile.id, matchedRole: "teacher" };
      if (profile.id === session.student_id) return { matchedUserId: profile.id, matchedRole: "student" };
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id);
      const roles = (roleRows || []).map((row: any) => row.role);
      if (roles.includes("student")) return { matchedUserId: profile.id, matchedRole: "student" };
      if (roles.includes("teacher")) return { matchedUserId: profile.id, matchedRole: "teacher" };
      return { matchedUserId: profile.id, matchedRole: roles[0] || "unknown" };
    }
  }

  const candidateIds = [session.teacher_id, session.student_id].filter(Boolean);
  if (candidateIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", candidateIds);

    const studentProfile = (profiles || []).find((profile: any) => profile.id === session.student_id);
    if (participantMatchesProfile(participantName, usableEmail, studentProfile)) {
      return { matchedUserId: session.student_id, matchedRole: "student" };
    }

    const teacherProfile = (profiles || []).find((profile: any) => profile.id === session.teacher_id);
    if (participantMatchesProfile(participantName, usableEmail, teacherProfile)) {
      return { matchedUserId: session.teacher_id, matchedRole: "teacher" };
    }
  }

  if (session.assignment_id || session.schedule_id) {
    const scheduledStudentId = await findScheduledStudent(supabase, session.teacher_id);
    if (scheduledStudentId) {
      const { data: scheduledProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", scheduledStudentId)
        .maybeSingle();

      if (!participantMatchesProfile(participantName, usableEmail, scheduledProfile)) {
        return { matchedUserId: null, matchedRole: "unknown" };
      }

      await supabase.from("live_sessions")
        .update({ student_id: scheduledStudentId })
        .eq("id", session.id);
      return { matchedUserId: scheduledStudentId, matchedRole: "student" };
    }
  }

  return { matchedUserId: null, matchedRole: "unknown" };
}

async function findExistingLeaveLog(
  supabase: any,
  params: {
    sessionId: string | null;
    licenseId: string;
    meetingUuid: string | null;
    participantName: string;
    participantEmail: string;
    leaveTime: Date;
  },
): Promise<any | null> {
  const windowStart = new Date(params.leaveTime.getTime() - 2 * 60 * 1000).toISOString();
  const windowEnd = new Date(params.leaveTime.getTime() + 2 * 60 * 1000).toISOString();
  let query = supabase
    .from("zoom_attendance_logs")
    .select("id, participant_name, participant_email")
    .eq("action", "leave")
    .gte("timestamp", windowStart)
    .lte("timestamp", windowEnd)
    .order("timestamp", { ascending: false })
    .limit(20);

  if (params.sessionId) {
    query = query.eq("session_id", params.sessionId);
  } else {
    query = query.eq("zoom_license_id", params.licenseId);
    if (params.meetingUuid) query = query.eq("zoom_meeting_uuid", params.meetingUuid);
  }

  const { data } = await query;
  return (data || []).find((entry: any) => sameParticipant(entry, params.participantName, params.participantEmail)) || null;
}

/**
 * Zoom does not always deliver meeting.ended (free rooms, host closing the app,
 * network drops). Without it a session stays "live" forever and the Control Room
 * shows an empty room as active. After every leave event we check whether anyone
 * is still inside; if the room is empty we close the session ourselves.
 */
async function closeSessionIfEmpty(supabase: any, sessionId: string, atIso: string) {
  const { data: stillInside } = await supabase
    .from("zoom_attendance_logs")
    .select("id")
    .eq("session_id", sessionId)
    .eq("action", "join_intent")
    .is("leave_time", null)
    .limit(1);

  if (stillInside && stillInside.length > 0) return;

  await supabase
    .from("live_sessions")
    .update({ status: "completed", actual_end: atIso })
    .eq("id", sessionId)
    .in("status", ["live", "scheduled"]);
  console.log("Room empty — session auto-closed:", sessionId);
}



async function getMonitorTeacherId(supabase: any, licenseId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("zoom_monitor_teacher_for_license", {
    _license_id: licenseId,
  });
  if (!error && data) return data;

  if (error) {
    console.error("Could not resolve monitor teacher by helper, using fallback:", licenseId, error);
  }

  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["teacher", "super_admin", "admin_division"])
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (roleErr) {
    console.error("Could not resolve fallback monitor user for license:", licenseId, roleErr);
    return null;
  }

  return roleRow?.user_id || null;
}

// NEW — dedicated-account resolver. Returns non-null when this hostId maps to
// a teacher's own Zoom account (not the shared Room 1/Room 2 pool).
async function resolveDedicatedAccount(
  supabase: any,
  hostId: string | undefined,
  meetingId?: string | number | null,
): Promise<{ id: string; teacher_id: string | null; zoom_account_email: string; tier: string } | null> {
  if (hostId) {
    const { data } = await supabase
      .from("zoom_accounts")
      .select("id, teacher_id, zoom_account_email, tier, is_active")
      .eq("zoom_user_id", hostId)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return data;
  }

  // SELF-HEAL: the account's Zoom user id may never have been synced (S2S app
  // created after the row). Fall back to matching the meeting number saved in
  // the account's meeting_link, then persist the host_id for next time.
  const digits = String(meetingId ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const { data: candidates } = await supabase
    .from("zoom_accounts")
    .select("id, teacher_id, zoom_account_email, tier, is_active, meeting_link, zoom_user_id")
    .eq("is_active", true);
  const match = (candidates || []).find((a: any) => {
    const m = /\/j\/(\d+)/.exec(a.meeting_link || "");
    return m && m[1] === digits;
  });
  if (!match) return null;
  if (hostId && !match.zoom_user_id) {
    await supabase.from("zoom_accounts").update({ zoom_user_id: hostId }).eq("id", match.id);
  }
  return match;
}


// Some Zoom accounts (e.g. the academy's shared licensed seat) have no
// teacher_id on zoom_accounts. Resolve the acting teacher from the account
// email first, then from the event's participant identity, so real Zoom
// events are never dropped with a NOT NULL violation.
async function resolveAccountTeacherId(
  supabase: any,
  account: { teacher_id: string | null; zoom_account_email: string },
  event: ZoomEvent,
): Promise<string | null> {
  if (account.teacher_id) return account.teacher_id;

  const isTeacher = async (userId: string | null | undefined) => {
    if (!userId) return false;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["teacher", "trial_teacher"]);
    return Boolean(data && data.length);
  };

  const byEmail = async (email?: string | null) => {
    const clean = normalizeParticipantValue(email);
    if (!clean) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", clean)
      .maybeSingle();
    return (await isTeacher(data?.id)) ? data!.id : null;
  };

  const fromAccountEmail = await byEmail(account.zoom_account_email);
  if (fromAccountEmail) return fromAccountEmail;

  const participant = event.payload.object?.participant;
  const fromParticipantEmail = await byEmail(participant?.email);
  if (fromParticipantEmail) return fromParticipantEmail;

  const rawName = (participant?.user_name || "").replace(/^\s*(teacher|ustadha?|ustadh|sir|miss|mr\.?|mrs\.?|ms\.?)\s+/i, "").trim();
  if (rawName.length >= 3) {
    const { data: matches } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", `%${rawName}%`)
      .limit(5);
    for (const m of matches || []) {
      if (await isTeacher(m.id)) return m.id;
    }
  }
  return null;
}

// NEW — find or create a live_sessions row for a dedicated account.
async function findOrCreateDedicatedSession(
  supabase: any,
  account: { id: string; teacher_id: string },
  meetingUuid: string | null,
  startTime: string,
): Promise<any | null> {
  if (meetingUuid) {
    const { data: byUuid } = await supabase
      .from("live_sessions")
      .select("id, teacher_id, student_id, status, assignment_id, schedule_id, license_id, zoom_account_id, scheduled_start, actual_start, session_source")
      .eq("zoom_meeting_uuid", meetingUuid)
      .maybeSingle();
    if (byUuid) return byUuid;
  }
  const recentCutoff = new Date(new Date(startTime).getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from("live_sessions")
    .select("id, teacher_id, student_id, status, assignment_id, schedule_id, license_id, zoom_account_id, scheduled_start, actual_start, session_source")
    .eq("zoom_account_id", account.id)
    .in("status", ["live", "scheduled"])
    .gte("created_at", recentCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) {
    if (meetingUuid) {
      await supabase
        .from("live_sessions")
        .update({ zoom_meeting_uuid: meetingUuid })
        .eq("id", active.id)
        .is("zoom_meeting_uuid", null);
    }
    return { ...active, zoom_meeting_uuid: meetingUuid || (active as any).zoom_meeting_uuid };
  }
  const { data: created, error } = await supabase
    .from("live_sessions")
    .insert({
      teacher_id: account.teacher_id,
      student_id: null,
      assignment_id: null,
      schedule_id: null,
      zoom_account_id: account.id,
      scheduled_start: startTime,
      actual_start: startTime,
      status: "live",
      zoom_meeting_uuid: meetingUuid,
      recording_status: "not_recorded",
      session_source: "zoom_dedicated",
    })
    .select("id, teacher_id, student_id, status, assignment_id, schedule_id, license_id, zoom_account_id, scheduled_start, actual_start, session_source")
    .single();
  if (error) {
    console.error("Could not create dedicated-account session:", error);
    return null;
  }
  return created;
}

// ---------- Dedicated-account event handler ----------
// One function handles meeting.started/ended, participant_joined/left,
// recording.completed for a teacher's own Zoom account. Session identity is
// the account owner (teacher_id) — no scheduled-owner heuristics required.
async function handleDedicatedAccountEvent(
  supabase: any,
  event: ZoomEvent,
  rawAccount: { id: string; teacher_id: string | null; zoom_account_email: string; tier: string },
  ctx: {
    hostId: string | undefined;
    meetingUuid: string | null;
    meetingId: string | number | null;
    supabaseUrl: string;
    supabaseServiceKey: string;
  },
) {
  const { hostId, meetingUuid, meetingId } = ctx;
  const resolvedTeacherId = await resolveAccountTeacherId(supabase, rawAccount, event);
  if (!resolvedTeacherId) {
    console.error(
      `Zoom account ${rawAccount.zoom_account_email} has no teacher_id and no teacher could be resolved from the event — skipping ${event.event}`,
    );
    return;
  }
  const account = { ...rawAccount, teacher_id: resolvedTeacherId };
  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", account.teacher_id)
    .maybeSingle();
  const hostName = teacherProfile?.full_name || account.zoom_account_email || "Meeting host";
  const hostEmail = teacherProfile?.email || account.zoom_account_email || "";

  switch (event.event) {
    case "meeting.started": {
      const startedAt = event.payload.object?.start_time || eventTime(event);
      const session = await findOrCreateDedicatedSession(supabase, account, meetingUuid, startedAt);
      if (!session) return;
      await supabase.from("live_sessions").update({
        status: "live",
        actual_start: startedAt,
        zoom_meeting_uuid: meetingUuid,
        zoom_account_id: account.id,
      }).eq("id", session.id);
      await insertZoomLog(supabase, {
        session_id: session.id,
        user_id: account.teacher_id,
        action: "join_intent",
        join_time: startedAt,
        timestamp: startedAt,
        participant_name: hostName,
        participant_email: hostEmail,
        role: "host",
        zoom_host_id: hostId,
        zoom_meeting_uuid: meetingUuid,
        zoom_meeting_id: meetingId,
        zoom_event_type: event.event,
        zoom_account_id: account.id,
      });
      return;
    }
    case "meeting.ended": {
      const endedAt = event.payload.object?.end_time || eventTime(event);
      const { data: sessions } = await supabase
        .from("live_sessions")
        .select("id, teacher_id, assignment_id, schedule_id, actual_start, scheduled_start")
        .eq("zoom_account_id", account.id)
        .in("status", ["live", "scheduled"]);
      for (const s of (sessions || [])) {
        await supabase
          .from("live_sessions")
          .update({ status: "completed", actual_end: endedAt, recording_status: "not_recorded" })
          .eq("id", s.id);
        // Zoom's meeting-ended event is authoritative: close every participant
        // still shown inside so stale rows can never keep a room blinking live.
        const { data: openParticipants } = await supabase
          .from("zoom_attendance_logs")
          .select("id, user_id, join_time, participant_name, participant_email, role")
          .eq("session_id", s.id)
          .eq("action", "join_intent")
          .is("leave_time", null);
        for (const openParticipant of openParticipants || []) {
          const join = openParticipant.join_time ? new Date(openParticipant.join_time) : new Date(endedAt);
          const totalMin = Math.max(1, Math.ceil((new Date(endedAt).getTime() - join.getTime()) / 60_000));
          await supabase.from("zoom_attendance_logs").update({
            leave_time: endedAt,
            total_duration_minutes: totalMin,
          }).eq("id", openParticipant.id);
          await insertZoomLog(supabase, {
            session_id: s.id,
            user_id: openParticipant.user_id,
            action: "leave",
            join_time: openParticipant.join_time,
            leave_time: endedAt,
            timestamp: endedAt,
            total_duration_minutes: totalMin,
            participant_name: openParticipant.participant_name,
            participant_email: openParticipant.participant_email,
            role: openParticipant.role,
            zoom_host_id: hostId,
            zoom_meeting_uuid: meetingUuid,
            zoom_meeting_id: meetingId,
            zoom_event_type: event.event,
            zoom_account_id: account.id,
          });
        }
      }
      return;
    }
    case "meeting.participant_joined": {
      const participant = event.payload.object?.participant;
      const pName = participant?.user_name || "Unknown";
      const pEmail = participant?.email || "";
      const joinTime = new Date(participant?.join_time || eventTime(event));
      const session = await findOrCreateDedicatedSession(supabase, account, meetingUuid, joinTime.toISOString());
      if (!session) return;
      if (session.status === "scheduled") {
        await supabase.from("live_sessions").update({
          status: "live",
          actual_start: joinTime.toISOString(),
          zoom_meeting_uuid: meetingUuid,
          zoom_account_id: account.id,
        }).eq("id", session.id);
        session.actual_start = joinTime.toISOString();
      }
      // Duplicate guard
      const { data: existingLogs } = await supabase
        .from("zoom_attendance_logs")
        .select("id, participant_name, participant_email")
        .eq("session_id", session.id)
        .eq("action", "join_intent")
        .is("leave_time", null);
      const dup = (existingLogs || []).find((e: any) => sameParticipant(e, pName, pEmail));
      if (dup) return;
      // Identity resolution — same routine as pooled path
      const { matchedUserId, matchedRole } = await resolveParticipantIdentity(
        supabase,
        session,
        pName,
        pEmail,
        account.zoom_account_email,
        hostName,
        participant?.user_id,
        hostId,
      );
      await insertZoomLog(supabase, {
        session_id: session.id,
        user_id: matchedUserId,
        action: "join_intent",
        join_time: joinTime.toISOString(),
        timestamp: joinTime.toISOString(),
        participant_name: pName,
        participant_email: pEmail,
        role: matchedRole,
        zoom_host_id: hostId,
        zoom_meeting_uuid: meetingUuid,
        zoom_meeting_id: meetingId,
        zoom_event_type: event.event,
        zoom_account_id: account.id,
      });
      return;
    }
    case "meeting.participant_left": {
      const participant = event.payload.object?.participant;
      const pName = participant?.user_name || "Unknown";
      const pEmail = participant?.email || "";
      const leaveTime = new Date(participant?.leave_time || eventTime(event));
      let session: any = null;
      if (meetingUuid) {
        const { data } = await supabase
          .from("live_sessions")
          .select("id, teacher_id, student_id, status, assignment_id, schedule_id, zoom_account_id, scheduled_start, actual_start")
          .eq("zoom_meeting_uuid", meetingUuid)
          .maybeSingle();
        session = data;
      }
      if (!session) {
        const { data } = await supabase
          .from("live_sessions")
          .select("id, teacher_id, student_id, status, assignment_id, schedule_id, zoom_account_id, scheduled_start, actual_start")
          .eq("zoom_account_id", account.id)
          .in("status", ["live", "scheduled", "completed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        session = data;
      }
      if (!session) return;
      const { data: openJoins } = await supabase
        .from("zoom_attendance_logs")
        .select("id, user_id, join_time, role, participant_name, participant_email, total_duration_minutes")
        .eq("session_id", session.id)
        .eq("action", "join_intent")
        .is("leave_time", null)
        .order("timestamp", { ascending: false })
        .limit(20);
      const matched = (openJoins || []).find((e: any) => sameParticipant(e, pName, pEmail));
      if (!matched) return;
      const joinT = new Date(matched.join_time);
      const durMin = Math.max(1, Math.ceil((leaveTime.getTime() - joinT.getTime()) / 60_000));
      const total = (matched.total_duration_minutes || 0) + durMin;
      await supabase.from("zoom_attendance_logs").update({
        leave_time: leaveTime.toISOString(),
        total_duration_minutes: total,
      }).eq("id", matched.id);
      await insertZoomLog(supabase, {
        session_id: session.id,
        user_id: matched.user_id,
        action: "leave",
        join_time: matched.join_time,
        leave_time: leaveTime.toISOString(),
        timestamp: leaveTime.toISOString(),
        total_duration_minutes: total,
        participant_name: pName,
        participant_email: pEmail,
        role: matched.role,
        zoom_host_id: hostId,
        zoom_meeting_uuid: meetingUuid,
        zoom_meeting_id: meetingId,
        zoom_event_type: event.event,
        zoom_account_id: account.id,
      });
      await closeSessionIfEmpty(supabase, session.id, leaveTime.toISOString());
      return;
    }
    case "recording.completed": {
      const recordingFiles = event.payload.object?.recording_files || [];
      const recordingPassword = event.payload.object?.password || null;
      let session: any = null;
      if (meetingUuid) {
        const { data } = await supabase
          .from("live_sessions")
          .select("id, teacher_id")
          .eq("zoom_meeting_uuid", meetingUuid)
          .maybeSingle();
        session = data;
      }
      if (!session) {
        const { data } = await supabase
          .from("live_sessions")
          .select("id, teacher_id")
          .eq("zoom_account_id", account.id)
          .eq("status", "completed")
          .order("actual_end", { ascending: false })
          .limit(1)
          .maybeSingle();
        session = data;
      }
      if (!session) return;
      const inserts = recordingFiles.map((f: any) => ({
        session_id: session.id,
        recording_type: f.recording_type || "unknown",
        play_url: f.play_url || null,
        download_url: f.download_url || null,
        password: recordingPassword,
        file_size_mb: f.file_size ? Math.round((f.file_size / 1048576) * 100) / 100 : null,
        file_type: f.file_type || "MP4",
        recording_start: f.recording_start || null,
        recording_end: f.recording_end || null,
        status: "pending",
      }));
      if (inserts.length > 0) {
        await supabase.from("session_recordings").insert(inserts);
      }
      await supabase.from("live_sessions").update({
        recording_status: "pending",
        zoom_meeting_uuid: meetingUuid,
        recording_password: recordingPassword,
        recording_fetched_at: null,
        download_attempts: 0,
        download_last_error: null,
      }).eq("id", session.id);
      try {
        fetch(`${ctx.supabaseUrl}/functions/v1/zoom-download-recording`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ctx.supabaseServiceKey}`,
          },
          body: JSON.stringify({ session_id: session.id }),
        }).catch((e) => console.error("Invoke downloader failed:", e));
      } catch (_) { /* ignore */ }
      return;
    }
    default:
      return;
  }
}

async function findOrCreateZoomSession(
  supabase: any,
  licenseId: string,
  meetingUuid: string | null,
  startTime: string,
): Promise<any | null> {
  if (meetingUuid) {
    const { data: sessionByMeeting } = await supabase
      .from("live_sessions")
        .select("id, teacher_id, actual_start, actual_end, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
      .eq("zoom_meeting_uuid", meetingUuid)
        .in("status", ["live", "scheduled", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionByMeeting) return sessionByMeeting;
  }

  const recentCutoff = new Date(new Date(startTime).getTime() - 2 * 60 * 60 * 1000).toISOString();
  const query = supabase
    .from("live_sessions")
    .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
    .eq("license_id", licenseId)
    .in("status", ["live", "scheduled"])
    .gte("created_at", recentCutoff)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: activeSession } = await query.maybeSingle();
  if (activeSession) {
    if (meetingUuid) {
      await supabase
        .from("live_sessions")
        .update({ zoom_meeting_uuid: meetingUuid })
        .eq("id", activeSession.id)
        .is("zoom_meeting_uuid", null);
    }
    return { ...activeSession, zoom_meeting_uuid: meetingUuid || activeSession.zoom_meeting_uuid };
  }

  const teacherId = await getMonitorTeacherId(supabase, licenseId);
  if (!teacherId) {
    console.log("No teacher/admin available to create monitor session for license:", licenseId);
    return null;
  }

  const sessionSource = "zoom_monitor";

  const { data: createdSession, error } = await supabase
    .from("live_sessions")
    .insert({
      teacher_id: teacherId,
      student_id: null,
      assignment_id: null,
      schedule_id: null,
      license_id: licenseId,
      scheduled_start: startTime,
      actual_start: startTime,
      status: "live",
      zoom_meeting_uuid: meetingUuid,
      recording_status: "not_recorded",
      session_source: sessionSource,
    })
    .select("id, teacher_id, actual_start, actual_end, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
    .single();

  if (error || !createdSession) {
    if (error?.code === "23505") {
      let query = supabase
        .from("live_sessions")
        .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
        .in("status", ["live", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(1);

      query = meetingUuid ? query.eq("zoom_meeting_uuid", meetingUuid) : query.eq("license_id", licenseId);

      const { data: existingSession } = await query.maybeSingle();
      if (existingSession) return existingSession;
    }
    console.error("Could not create monitor session for Zoom webhook:", error);
    return null;
  }

  console.log("Created monitor session from Zoom webhook:", createdSession.id);
  return createdSession;
}

async function insertZoomLog(supabase: any, payload: Record<string, unknown>) {
  const { error } = await supabase.from("zoom_attendance_logs").insert(payload);
  if (error) {
    // 23505 = unique_violation — expected when Zoom re-delivers the same event; safe to ignore.
    if ((error as any).code === "23505" || /duplicate key|already exists/i.test(error.message || "")) {
      console.log("Duplicate Zoom log ignored (unique index):", payload.action, payload.participant_name);
      return;
    }
    console.error("Error inserting Zoom attendance log:", error, payload);
  }
}

async function recordHostJoin(
  supabase: any,
  session: any,
  license: { id: string; zoom_email?: string | null },
  hostId: string | undefined,
  meetingUuid: string | null,
  meetingId: string | number | null,
  joinedAt: string,
  eventName: string,
) {
  if (!session?.id) return;
  const hostEmail = license.zoom_email || "";
  let hostName = hostEmail || "Meeting host";
  let resolvedHostEmail = hostEmail;

  const { data: teacherProfile } = session.teacher_id
    ? await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.teacher_id)
      .maybeSingle()
    : { data: null } as any;

  if (teacherProfile?.full_name) hostName = teacherProfile.full_name;
  if (teacherProfile?.email) resolvedHostEmail = teacherProfile.email;

  const { data: existing } = await supabase
    .from("zoom_attendance_logs")
    .select("id, user_id, join_time, timestamp, participant_name, participant_email, zoom_event_type")
    .eq("session_id", session.id)
    .eq("action", "join_intent")
    .is("leave_time", null)
    .eq("role", "host")
    .limit(10);

  const existingHost = (existing || []).find((entry: any) =>
    (session.teacher_id && entry.user_id === session.teacher_id) ||
    entry.zoom_event_type === "app.host_join_intent" ||
    sameParticipant(entry, hostName, resolvedHostEmail) ||
    sameParticipant(entry, license.zoom_email || "Meeting host", license.zoom_email || "")
  );

  if (existingHost) {
    await supabase.from("zoom_attendance_logs").update({
      user_id: existingHost.user_id || session.teacher_id || null,
      join_time: existingHost.join_time || joinedAt,
      timestamp: existingHost.timestamp || joinedAt,
      participant_name: existingHost.participant_name || hostName,
      participant_email: existingHost.participant_email || resolvedHostEmail,
      role: "host",
      zoom_host_id: hostId,
      zoom_meeting_uuid: meetingUuid,
      zoom_meeting_id: meetingId,
      zoom_event_type: eventName,
      zoom_license_id: license.id,
    }).eq("id", existingHost.id);
    return;
  }

  await insertZoomLog(supabase, {
    session_id: session.id,
    user_id: session.teacher_id || null,
    action: "join_intent",
    join_time: joinedAt,
    timestamp: joinedAt,
    participant_name: hostName,
    participant_email: resolvedHostEmail,
    role: "host",
    zoom_host_id: hostId,
    zoom_meeting_uuid: meetingUuid,
    zoom_meeting_id: meetingId,
    zoom_event_type: eventName,
    zoom_license_id: license.id,
  });
}

async function recordHostLeave(
  supabase: any,
  session: any,
  license: { id: string; zoom_email?: string | null },
  hostId: string | undefined,
  meetingUuid: string | null,
  meetingId: string | number | null,
  leftAt: string,
  eventName: string,
) {
  if (!session?.id) return;
  const hostEmail = license.zoom_email || "";
  let hostName = hostEmail || "Meeting host";
  let resolvedHostEmail = hostEmail;
  const { data: teacherProfile } = session.teacher_id
    ? await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.teacher_id)
      .maybeSingle()
    : { data: null } as any;
  if (teacherProfile?.full_name) hostName = teacherProfile.full_name;
  if (teacherProfile?.email) resolvedHostEmail = teacherProfile.email;
  const leaveTime = new Date(leftAt);

  const { data: openJoins } = await supabase
    .from("zoom_attendance_logs")
    .select("id, user_id, join_time, total_duration_minutes, participant_name, participant_email, zoom_event_type")
    .eq("session_id", session.id)
    .eq("action", "join_intent")
    .eq("role", "host")
    .is("leave_time", null)
    .order("timestamp", { ascending: false })
    .limit(10);

  const matchedLog = (openJoins || []).find((entry: any) =>
    (session.teacher_id && entry.user_id === session.teacher_id) ||
    entry.zoom_event_type === "app.host_join_intent" ||
    sameParticipant(entry, hostName, resolvedHostEmail) ||
    sameParticipant(entry, license.zoom_email || "Meeting host", license.zoom_email || "")
  );
  const existingLeave = await findExistingLeaveLog(supabase, {
    sessionId: session.id,
    licenseId: license.id,
    meetingUuid,
    participantName: hostName,
    participantEmail: resolvedHostEmail,
    leaveTime,
  });
  if (existingLeave) return;

  let joinTime: string | null = matchedLog?.join_time || session.actual_start || null;
  let totalDuration: number | null = null;
  if (joinTime) {
    totalDuration = Math.max(1, Math.ceil((leaveTime.getTime() - new Date(joinTime).getTime()) / 60_000));
  }

  if (matchedLog) {
    await supabase.from("zoom_attendance_logs").update({
      leave_time: leftAt,
      total_duration_minutes: totalDuration,
      user_id: matchedLog.user_id || session.teacher_id || null,
      participant_name: matchedLog.participant_name || hostName,
      participant_email: matchedLog.participant_email || resolvedHostEmail,
      zoom_host_id: hostId,
      zoom_meeting_uuid: meetingUuid,
      zoom_meeting_id: meetingId,
      zoom_license_id: license.id,
    }).eq("id", matchedLog.id);
  }

  await insertZoomLog(supabase, {
    session_id: session.id,
    user_id: matchedLog?.user_id || session.teacher_id || null,
    action: "leave",
    join_time: joinTime,
    leave_time: leftAt,
    timestamp: leftAt,
    total_duration_minutes: totalDuration,
    participant_name: matchedLog?.participant_name || hostName,
    participant_email: matchedLog?.participant_email || resolvedHostEmail,
    role: "host",
    zoom_host_id: hostId,
    zoom_meeting_uuid: meetingUuid,
    zoom_meeting_id: meetingId,
    zoom_event_type: eventName,
    zoom_license_id: license.id,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();

    // Zoom's "Validate the URL" challenge is sent WITHOUT signature headers.
    // It must be answered immediately, before any signature/timestamp checks.
    let event: ZoomEvent;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Each Zoom Marketplace app has its OWN Secret Token. To support many apps
    // on one endpoint, the URL may carry ?app=<slug>, which maps to the secret
    // ZOOM_SECRET_TOKEN_<SLUG_UPPERCASE>. Falls back to the global token.
    const appSlug = (new URL(req.url).searchParams.get("app") || "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toUpperCase();
    const scopedToken = appSlug ? Deno.env.get(`ZOOM_SECRET_TOKEN_${appSlug}`) : undefined;
    const secretToken = scopedToken || Deno.env.get("ZOOM_SECRET_TOKEN");

    if (event.event === "endpoint.url_validation") {
      if (!secretToken) {
        console.error(`ZOOM_SECRET_TOKEN${appSlug ? `_${appSlug}` : ""} not configured — cannot answer URL validation`);
        return new Response(
          JSON.stringify({ error: "Webhook secret not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const plainToken = event.payload?.plainToken || "";
      const encryptedToken = createHmac("sha256", secretToken)
        .update(plainToken)
        .digest("hex");
      console.log(`Responding to Zoom URL validation challenge (app=${appSlug || "default"}, scoped=${Boolean(scopedToken)})`);
      return new Response(
        JSON.stringify({ plainToken, encryptedToken }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const zoomSignature = req.headers.get("x-zm-signature");
    const zoomTimestamp = req.headers.get("x-zm-request-timestamp");

    if (!secretToken) {
      console.error("ZOOM_SECRET_TOKEN not configured - rejecting request");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!zoomSignature || !zoomTimestamp) {
      console.error("Missing Zoom signature headers");
      return new Response(
        JSON.stringify({ error: "Missing signature headers" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestampAge = Math.abs(Date.now() / 1000 - Number(zoomTimestamp));
    if (timestampAge > 300) {
      console.error("Zoom webhook timestamp too old - possible replay attack");
      return new Response(
        JSON.stringify({ error: "Request expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValid = verifyZoomSignature(zoomSignature, zoomTimestamp, body, secretToken);
    if (!isValid) {
      console.error("Invalid Zoom webhook signature - request rejected");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== ZOOM WEBHOOK ===", event.event, new Date().toISOString());

    // Persist raw payload BEFORE any processing so admins can audit what Zoom actually sent
    // (including duplicate deliveries) vs what ended up in Join Logs. Never let this fail the request.
    try {
      const p = event.payload?.object || ({} as any);
      await supabase.from("zoom_webhook_events").insert({
        event_type: event.event,
        event_ts: event.event_ts ? new Date(event.event_ts).toISOString() : null,
        zoom_meeting_uuid: p.uuid || null,
        zoom_meeting_id: p.id?.toString() || null,
        zoom_host_id: p.host_id || null,
        participant_name: p.participant?.user_name || null,
        participant_email: p.participant?.email || null,
        raw_payload: event as unknown as Record<string, unknown>,
      });
    } catch (e) {
      console.error("Failed to log raw zoom webhook event:", e);
    }

    const hostId = event.payload.object?.host_id;
    const meetingUuidTop = event.payload.object?.uuid || null;
    const meetingIdTop = event.payload.object?.id || null;


    // DEDICATED-ACCOUNT FAST PATH — bypass shared-pool logic entirely when the
    // host_id belongs to a teacher's dedicated zoom_accounts row.
    const dedicatedAccount = await resolveDedicatedAccount(supabase, hostId, meetingIdTop);
    if (dedicatedAccount) {
      await handleDedicatedAccountEvent(supabase, event, dedicatedAccount, {
        hostId,
        meetingUuid: meetingUuidTop,
        meetingId: meetingIdTop,
        supabaseUrl,
        supabaseServiceKey,
      });
      return new Response(JSON.stringify({ success: true, path: "dedicated_account" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (event.event) {
      case "meeting.started": {
        console.log("Meeting started, host:", hostId);
        const startedAt = event.payload.object?.start_time || eventTime(event);
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id, zoom_email")
          .eq("host_id", hostId)
          .maybeSingle();
        if (license) {
          await supabase.from("zoom_licenses").update({ status: "busy", last_used_at: startedAt }).eq("id", license.id);
          console.log("License marked busy:", license.id);
          let sessionForHostLog: any = null;

          // Activate any scheduled session that was pre-created (e.g. by student early join)
          const { data: pendingSession } = await supabase
            .from("live_sessions")
            .select("id, teacher_id, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
            .eq("license_id", license.id)
            .eq("status", "scheduled")
            .gte("created_at", new Date(new Date(startedAt).getTime() - 2 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pendingSession) {
            await supabase.from("live_sessions").update({
              status: "live",
              actual_start: startedAt,
              zoom_meeting_uuid: meetingUuidTop,
            }).eq("id", pendingSession.id);
            sessionForHostLog = { ...pendingSession, actual_start: startedAt };
            console.log("Activated pending session:", pendingSession.id);
          } else {
            // Also check sessions without license_id (teacher may have created session before license assignment)
            const { data: unlinkedSession } = await supabase
              .from("live_sessions")
              .select("id, teacher_id, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
              .is("license_id", null)
              .eq("status", "scheduled")
              .gte("created_at", new Date(new Date(startedAt).getTime() - 2 * 60 * 60 * 1000).toISOString())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (unlinkedSession) {
              await supabase.from("live_sessions").update({
                status: "live",
                actual_start: startedAt,
                license_id: license.id,
                zoom_meeting_uuid: meetingUuidTop,
              }).eq("id", unlinkedSession.id);
              sessionForHostLog = { ...unlinkedSession, license_id: license.id, actual_start: startedAt };
              console.log("Linked and activated unlinked session:", unlinkedSession.id);
            } else {
              sessionForHostLog = await findOrCreateZoomSession(supabase, license.id, meetingUuidTop, startedAt);
            }
          }

          await recordHostJoin(supabase, sessionForHostLog, license, hostId, meetingUuidTop, meetingIdTop, startedAt, event.event);
        } else {
          console.log("No license found for host_id:", hostId);
        }
        break;
      }

      case "meeting.ended": {
        console.log("Meeting ended, host:", hostId);
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();
        if (license) {
          // Find both live AND scheduled sessions for this license
          const { data: liveSessions } = await supabase
            .from("live_sessions")
            .select("id, teacher_id, assignment_id, schedule_id, actual_start, scheduled_start")
            .eq("license_id", license.id)
            .in("status", ["live", "scheduled"]);

          const endedAt = event.payload.object?.end_time || eventTime(event);
          await supabase.from("zoom_licenses").update({ status: "available" }).eq("id", license.id);
          await supabase
            .from("live_sessions")
            .update({ status: "completed", actual_end: endedAt, recording_status: "not_recorded" })
            .eq("license_id", license.id)
            .in("status", ["live", "scheduled"]);
          console.log("License released, sessions completed:", license.id);

          // Auto-mark attendance for each ended session
          for (const session of (liveSessions || [])) {
            await recordHostLeave(supabase, session, license, hostId, meetingUuidTop, meetingIdTop, endedAt, event.event);
            if (!session.teacher_id) continue;

            // Resolve scheduled duration from linked schedule/assignment
            let scheduledDurationMin = 30;
            if (session.schedule_id) {
              const { data: sch } = await supabase
                .from("schedules")
                .select("duration_minutes")
                .eq("id", session.schedule_id)
                .maybeSingle();
              if (sch?.duration_minutes) scheduledDurationMin = sch.duration_minutes;
            } else if (session.assignment_id) {
              const { data: asg } = await supabase
                .from("student_teacher_assignments")
                .select("duration_minutes")
                .eq("id", session.assignment_id)
                .maybeSingle();
              if (asg?.duration_minutes) scheduledDurationMin = asg.duration_minutes;
            }

            const scheduledStart = session.scheduled_start
              ? new Date(session.scheduled_start)
              : session.actual_start
              ? new Date(session.actual_start)
              : new Date(endedAt);
            const scheduledEnd = new Date(scheduledStart.getTime() + scheduledDurationMin * 60_000);
            // CANONICAL class_date: the TEACHER-local calendar date, matching the
            // frame that schedules.day_of_week / teacher_local_time are defined in.
            // Using UTC here filed cross-midnight classes one day off, which made
            // already-marked classes show up in the Missing Attendance report.
            let teacherTz = "Asia/Karachi";
            {
              const { data: tProfile } = await supabase
                .from("profiles")
                .select("timezone")
                .eq("id", session.teacher_id)
                .maybeSingle();
              if (tProfile?.timezone) teacherTz = tProfile.timezone;
            }
            const teacherParts = (instant: Date, timeZone: string) => {
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone,
                hour12: false,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).formatToParts(instant);
              const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
              return { get, hour: Number(get("hour")) % 24 };
            };
            const teacherLocalClassDate = (instant: Date, timeZone: string) => {
              const { get } = teacherParts(instant, timeZone);
              return `${get("year")}-${get("month")}-${get("day")}`;
            };
            const teacherLocalClassTime = (instant: Date, timeZone: string) => {
              const { get, hour } = teacherParts(instant, timeZone);
              return `${String(hour).padStart(2, "0")}:${get("minute")}`;
            };
            const classDate = teacherLocalClassDate(scheduledStart, teacherTz);
            const classTime = teacherLocalClassTime(scheduledStart, teacherTz);

            // Only auto-mark for 1:1 sessions (skip multi-student group monitor rows we don't
            // have per-student roster confidence for; those keep their existing manual flow).
            if (!session.assignment_id) continue;

            // Get expected students for this teacher (1:1 assignment)
            const { data: assignments } = await supabase
              .from("student_teacher_assignments")
              .select("student_id")
              .eq("id", session.assignment_id)
              .eq("status", "active");
            if (!assignments || assignments.length === 0) continue;

            // Collect matched participant totals for this session
            const { data: logs } = await supabase
              .from("zoom_attendance_logs")
              .select("user_id, role, join_time, leave_time, total_duration_minutes")
              .eq("session_id", session.id)
              .not("user_id", "is", null);

            // Aggregate minutes per student user_id
            const totals = new Map<string, { minutes: number; firstJoin: Date | null; lastLeave: Date | null }>();
            for (const l of (logs || [])) {
              if (l.role !== "student") continue;
              const acc = totals.get(l.user_id) || { minutes: 0, firstJoin: null, lastLeave: null };
              if (typeof l.total_duration_minutes === "number") {
                acc.minutes = Math.max(acc.minutes, l.total_duration_minutes);
              } else if (l.join_time && l.leave_time) {
                acc.minutes += Math.max(1, Math.ceil(
                  (new Date(l.leave_time).getTime() - new Date(l.join_time).getTime()) / 60_000
                ));
              }
              const jt = l.join_time ? new Date(l.join_time) : null;
              const lt = l.leave_time ? new Date(l.leave_time) : null;
              if (jt && (!acc.firstJoin || jt < acc.firstJoin)) acc.firstJoin = jt;
              if (lt && (!acc.lastLeave || lt > acc.lastLeave)) acc.lastLeave = lt;
              totals.set(l.user_id, acc);
            }

            const halfDuration = scheduledDurationMin / 2;

            for (const a of assignments) {
              const t = totals.get(a.student_id);
              const notes: string[] = [];
              let status: string;

              if (!t || t.minutes === 0) {
                status = "student_absent";
                notes.push(`Auto-marked: no Zoom join detected for session ${session.id}`);
              } else {
                // Present if >= 50% of scheduled duration; otherwise short attendance still logged as present with note
                if (t.minutes >= halfDuration) {
                  status = "present";
                } else {
                  status = "present";
                  notes.push(`Short attendance: only ${t.minutes} of ${scheduledDurationMin} min`);
                }
                if (t.firstJoin) {
                  const lateMin = Math.floor((t.firstJoin.getTime() - scheduledStart.getTime()) / 60_000);
                  if (lateMin > 5) notes.push(`Late ${lateMin}m`);
                }
                if (t.lastLeave) {
                  const earlyMin = Math.floor((scheduledEnd.getTime() - t.lastLeave.getTime()) / 60_000);
                  if (earlyMin > 5) notes.push(`Left early ${earlyMin}m`);
                }
                notes.push(`Attended ${t.minutes}/${scheduledDurationMin} min via Zoom`);
              }

              // The attendance_block_duplicate trigger enforces (student_id, teacher_id,
              // class_date, class_time) uniqueness. Insert here — if a teacher already
              // manually marked this slot, the insert fails with unique_violation and we
              // swallow it, preserving the manual record.
              const { error: insErr } = await supabase.from("attendance").insert({
                student_id: a.student_id,
                teacher_id: session.teacher_id,
                class_date: classDate,
                class_time: classTime,
                duration_minutes: scheduledDurationMin,
                status,
                lesson_notes: notes.join(" · "),
                student_join_time: t?.firstJoin?.toISOString() || null,
              });
              if (insErr && (insErr as any).code !== "23505" && !/already exists/i.test(insErr.message || "")) {
                console.error("Auto-attendance insert failed:", insErr, { student: a.student_id, session: session.id });
              } else if (!insErr) {
                console.log(`Auto-attendance ${status} for student ${a.student_id} in session ${session.id}`);
              } else {
                console.log(`Manual attendance already present, skipped auto-mark for ${a.student_id}`);
              }
            }
          }
        }
        break;
      }


      case "meeting.participant_joined": {
        const participant = event.payload.object?.participant;
        const pName = participant?.user_name || "Unknown";
        const pEmail = participant?.email || "";
        console.log("Participant joined:", pName, pEmail, "host:", hostId);

        // Step 1: Find the license by host_id
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id, zoom_email")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) {
          console.log("No license found for host_id:", hostId);
          break;
        }

        // Step 2: Find the active live OR scheduled session for this license
        const joinTime = new Date(participant?.join_time || eventTime(event));
        const session = await findOrCreateZoomSession(supabase, license.id, meetingUuidTop, joinTime.toISOString());

        if (!session) {
          console.log("No active session for license:", license.id, "— logging raw event only");
          await insertZoomLog(supabase, {
            session_id: null,
            user_id: null,
            action: "join_intent",
            join_time: joinTime.toISOString(),
            timestamp: joinTime.toISOString(),
            participant_name: pName,
            participant_email: pEmail,
            role: "unknown",
            zoom_host_id: hostId,
            zoom_meeting_uuid: meetingUuidTop,
            zoom_meeting_id: meetingIdTop,
            zoom_event_type: event.event,
            zoom_license_id: license.id,
          });
          break;
        }

        // If session is still 'scheduled', activate it now (first person joined).
        // If Zoom delivered an old join after meeting.ended, keep it attached to
        // the completed session but never reopen the room.
        if (session.status === "scheduled") {
          await supabase.from("live_sessions").update({
            status: "live",
            actual_start: joinTime.toISOString(),
            zoom_meeting_uuid: meetingUuidTop,
          }).eq("id", session.id);
          session.actual_start = joinTime.toISOString();
          console.log("Session activated by participant join:", session.id);
        }

        // Step 3: Determine if this is the teacher/student without assuming
        // the first participant is the teacher. Direct Zoom test meetings often
        // have a monitor session owned by an admin/teacher, but that owner is
        // not necessarily the person who just joined.
        // Check existing open join logs first. Zoom may send duplicate webhook
        // deliveries for the same participant; keep one open join per person.
        const { data: existingLogs } = await supabase
          .from("zoom_attendance_logs")
          .select("id, user_id, role, participant_name, participant_email")
          .eq("session_id", session.id)
          .eq("action", "join_intent")
          .is("leave_time", null);

        const duplicateOpenJoin = (existingLogs || []).find((entry: any) => sameParticipant(entry, pName, pEmail));
        if (duplicateOpenJoin) {
          await supabase.from("zoom_attendance_logs").update({
            participant_name: pName,
            participant_email: pEmail,
            zoom_host_id: hostId,
            zoom_meeting_uuid: meetingUuidTop,
            zoom_meeting_id: meetingIdTop,
            zoom_event_type: event.event,
            zoom_license_id: license.id,
          }).eq("id", duplicateOpenJoin.id);
          console.log("Duplicate join webhook ignored for participant:", pName, "session:", session.id);
          break;
        }

        const { matchedUserId, matchedRole } = await resolveParticipantIdentity(
          supabase,
          session,
          pName,
          pEmail,
          license.zoom_email,
          undefined,
          participant?.user_id,
          hostId,
        );

        let isLate = false;
        let lateMinutes = 0;
        if (session.actual_start) {
          lateMinutes = Math.floor((joinTime.getTime() - new Date(session.actual_start).getTime()) / 60000);
          isLate = lateMinutes > 10;
        }

        await insertZoomLog(supabase, {
          session_id: session.id,
          user_id: matchedUserId,
          action: "join_intent",
          join_time: joinTime.toISOString(),
          timestamp: joinTime.toISOString(),
          participant_name: pName,
          participant_email: pEmail,
          role: matchedRole,
          zoom_host_id: hostId,
          zoom_meeting_uuid: meetingUuidTop,
          zoom_meeting_id: meetingIdTop,
          zoom_event_type: event.event,
          zoom_license_id: license.id,
        });
        console.log(`Join logged: role=${matchedRole}, user=${matchedUserId}, late=${isLate} (${lateMinutes}m)`);

        // Late notification for students
        if (isLate && matchedRole === "student" && matchedUserId) {
          const { data: parentLink } = await supabase
            .from("student_parent_links")
            .select("parent_id")
            .eq("student_id", matchedUserId)
            .maybeSingle();
          if (parentLink) {
            await supabase.from("notification_queue").insert({
              recipient_id: parentLink.parent_id,
              recipient_type: "parent",
              notification_type: "late_join",
              title: "Late Entry Alert",
              message: `${pName} joined class ${lateMinutes} minutes late.`,
              metadata: { user_id: matchedUserId, late_minutes: lateMinutes, session_id: session.id, status: "Late" },
            });
          }
        }
        break;
      }

      case "meeting.participant_left": {
        const participant = event.payload.object?.participant;
        const pName = participant?.user_name || "Unknown";
        const pEmail = participant?.email || "";
        console.log("Participant left:", pName, pEmail, "host:", hostId);

        // Find license → session
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id, zoom_email")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) { console.log("No license for host:", hostId); break; }

        const leaveTime = new Date(participant?.leave_time || eventTime(event));

        // Find session by meeting UUID first, then by recent active room.
        let session: any = null;
        if (meetingUuidTop) {
          const { data } = await supabase
            .from("live_sessions")
            .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
            .eq("zoom_meeting_uuid", meetingUuidTop)
            .in("status", ["live", "scheduled", "completed"])
            .order("actual_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          session = data;
        }

        if (!session) {
          const { data } = await supabase
            .from("live_sessions")
            .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id, license_id, scheduled_start, session_source")
            .eq("license_id", license.id)
            .in("status", ["live", "scheduled", "completed"])
            .gte("created_at", new Date(leaveTime.getTime() - 2 * 60 * 60 * 1000).toISOString())
            .order("actual_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          session = data;
        }

        if (!session) {
          session = await findOrCreateZoomSession(supabase, license.id, meetingUuidTop, leaveTime.toISOString());
        }

        if (!session) {
          console.log("No session found for license:", license.id, "— matching raw join log");
        }

        const queryOpenJoins = async (scope: "session" | "raw") => {
          let query = supabase
            .from("zoom_attendance_logs")
            .select("id, user_id, join_time, total_duration_minutes, role, participant_name, participant_email")
            .eq("action", "join_intent")
            .is("leave_time", null)
            .order("timestamp", { ascending: false })
            .limit(20);

          if (scope === "session" && session) {
            query = query.eq("session_id", session.id);
          } else {
            query = query.eq("zoom_license_id", license.id);
            if (meetingUuidTop) query = query.eq("zoom_meeting_uuid", meetingUuidTop);
          }

          const { data } = await query;
          return data || [];
        };

        let joinLog = session ? await queryOpenJoins("session") : [];
        if (joinLog.length === 0) {
          joinLog = await queryOpenJoins("raw");
        }

        // Try to match by participant name/email
        let matchedLog = null;
        if (joinLog && joinLog.length > 0) {
          matchedLog = joinLog.find((entry: any) => sameParticipant(entry, pName, pEmail)) || null;
        }

        if (!matchedLog) {
          console.log("No matching join record for leave event, session:", session?.id || "raw");
          const existingLeave = await findExistingLeaveLog(supabase, {
            sessionId: session?.id || null,
            licenseId: license.id,
            meetingUuid: meetingUuidTop,
            participantName: pName,
            participantEmail: pEmail,
            leaveTime,
          });

          if (existingLeave) {
            console.log("Duplicate unmatched leave webhook ignored for participant:", pName);
            break;
          }

          await insertZoomLog(supabase, {
            session_id: session?.id || null,
            user_id: null,
            action: "leave",
            leave_time: leaveTime.toISOString(),
            timestamp: leaveTime.toISOString(),
            participant_name: pName,
            participant_email: pEmail,
            role: "unknown",
            zoom_host_id: hostId,
            zoom_meeting_uuid: meetingUuidTop,
            zoom_meeting_id: meetingIdTop,
            zoom_event_type: event.event,
            zoom_license_id: license.id,
          });
          break;
        }

        const joinTime = new Date(matchedLog.join_time);
        const sessionMinutes = Math.max(1, Math.ceil((leaveTime.getTime() - joinTime.getTime()) / 60000));
        const previousTotal = matchedLog.total_duration_minutes || 0;
        const newTotal = previousTotal + sessionMinutes;

        await supabase.from("zoom_attendance_logs").update({
          leave_time: leaveTime.toISOString(),
          total_duration_minutes: newTotal,
          participant_name: pName,
          participant_email: pEmail,
          zoom_host_id: hostId,
          zoom_meeting_uuid: meetingUuidTop,
          zoom_meeting_id: meetingIdTop,
          zoom_license_id: license.id,
        }).eq("id", matchedLog.id);

        const existingLeave = await findExistingLeaveLog(supabase, {
          sessionId: session?.id || null,
          licenseId: license.id,
          meetingUuid: meetingUuidTop,
          participantName: pName,
          participantEmail: pEmail,
          leaveTime,
        });

        if (!existingLeave) {
          await insertZoomLog(supabase, {
            session_id: session?.id || null,
            user_id: matchedLog.user_id,
            action: "leave",
            join_time: matchedLog.join_time,
            leave_time: leaveTime.toISOString(),
            timestamp: leaveTime.toISOString(),
            total_duration_minutes: newTotal,
            participant_name: pName,
            participant_email: pEmail,
            role: matchedLog.role,
            zoom_host_id: hostId,
            zoom_meeting_uuid: meetingUuidTop,
            zoom_meeting_id: meetingIdTop,
            zoom_event_type: event.event,
            zoom_license_id: license.id,
          });
        }

        console.log(`Leave logged: role=${matchedLog.role}, user=${matchedLog.user_id}, duration=${sessionMinutes}m, total=${newTotal}m`);

        // Short session notification for students
        if (sessionMinutes < 25 && matchedLog.role === "student" && matchedLog.user_id) {
          const { data: parentLink } = await supabase
            .from("student_parent_links")
            .select("parent_id")
            .eq("student_id", matchedLog.user_id)
            .maybeSingle();
          if (parentLink) {
            await supabase.from("notification_queue").insert({
              recipient_id: parentLink.parent_id,
              recipient_type: "parent",
              notification_type: "short_session",
              title: "Short Session Alert",
                message: `${pName} left class after ${sessionMinutes} minutes (Total: ${newTotal} mins).`,
                metadata: { user_id: matchedLog.user_id, session_minutes: sessionMinutes, total_minutes: newTotal, session_id: session?.id || null },
            });
          }
        }

        if (session?.id) {
          await closeSessionIfEmpty(supabase, session.id, leaveTime.toISOString());
        }
        break;
      }

      case "recording.completed": {
        console.log("=== RECORDING COMPLETED ===", hostId);
        const recordingFiles = event.payload.object?.recording_files || [];
        const recordingPassword = event.payload.object?.password || null;
        const meetingUuid = event.payload.object?.uuid || null;
        const meetingId = event.payload.object?.id || null;

        let session: any = null;
        if (meetingUuid) {
          const { data } = await supabase
            .from("live_sessions")
            .select("id, teacher_id")
            .eq("zoom_meeting_uuid", meetingUuid)
            .maybeSingle();
          session = data;
        }

        if (!session) {
          const { data: license } = await supabase
            .from("zoom_licenses")
            .select("id, zoom_email")
            .eq("host_id", hostId)
            .maybeSingle();
          if (license) {
            const { data } = await supabase
              .from("live_sessions")
              .select("id, teacher_id")
              .eq("license_id", license.id)
              .eq("status", "completed")
              .order("actual_end", { ascending: false })
              .limit(1)
              .maybeSingle();
            session = data;
          }
        }

        if (!session) {
          console.error("RECORDING UNMATCHED — manual review needed", { hostId, meetingUuid, meetingId });
          try {
            await supabase.from("system_logs").insert({
              log_type: "zoom_recording_unmatched",
              severity: "warning",
              message: `Zoom recording completed but no matching session. host=${hostId} uuid=${meetingUuid}`,
              metadata: { hostId, meetingUuid, meetingId, files: recordingFiles.length },
            });
          } catch (_) { /* ignore */ }
          break;
        }

        const recordingInserts = recordingFiles.map((file: any) => ({
          session_id: session.id,
          recording_type: file.recording_type || "unknown",
          play_url: file.play_url || null,
          download_url: file.download_url || null,
          password: recordingPassword,
          file_size_mb: file.file_size ? Math.round((file.file_size / 1048576) * 100) / 100 : null,
          file_type: file.file_type || "MP4",
          recording_start: file.recording_start || null,
          recording_end: file.recording_end || null,
          status: "pending",
        }));

        if (recordingInserts.length > 0) {
          const { error: recErr } = await supabase.from("session_recordings").insert(recordingInserts);
          if (recErr) console.error("Error inserting recordings:", recErr);
        }

        await supabase.from("live_sessions").update({
          recording_status: "pending",
          zoom_meeting_uuid: meetingUuid,
          recording_password: recordingPassword,
          recording_fetched_at: null,
          download_attempts: 0,
          download_last_error: null,
        }).eq("id", session.id);

        // Fire-and-forget invoke of the downloader
        try {
          fetch(`${supabaseUrl}/functions/v1/zoom-download-recording`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ session_id: session.id }),
          }).catch((e) => console.error("Invoke downloader failed:", e));
        } catch (e) {
          console.error("Failed to invoke downloader:", e);
        }

        console.log("Recording queued for download:", session.id);
        break;
      }

      default:
        console.log("Unhandled Zoom event:", event.event);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Zoom webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
