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
  const { data: schedules } = await supabase
    .from("schedules")
    .select("assignment_id, student_local_time, duration_minutes")
    .in("assignment_id", assignmentIds)
    .eq("day_of_week", today)
    .eq("is_active", true);

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

function isHostParticipant(participantName: string, participantEmail: string, hostEmail?: string | null): boolean {
  const currentEmail = normalizeParticipantValue(participantEmail);
  const currentName = normalizeParticipantValue(participantName);
  const normalizedHostEmail = normalizeParticipantValue(hostEmail);

  if (currentEmail && normalizedHostEmail && currentEmail === normalizedHostEmail) return true;

  const hostLocalPart = normalizedHostEmail.split("@")[0];
  if (hostLocalPart && currentName && currentName === hostLocalPart) return true;

  return currentName.includes("al-quran time class") || currentName.includes("al quran time class");
}

async function resolveParticipantIdentity(
  supabase: any,
  session: any,
  participantName: string,
  participantEmail: string,
  hostEmail?: string | null,
): Promise<{ matchedUserId: string | null; matchedRole: string }> {
  if (isHostParticipant(participantName, participantEmail, hostEmail)) {
    return { matchedUserId: session.teacher_id || null, matchedRole: "teacher" };
  }

  if (participantEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", participantEmail)
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

  if (session.student_id) {
    return { matchedUserId: session.student_id, matchedRole: "student" };
  }

  if (session.assignment_id || session.schedule_id) {
    const scheduledStudentId = await findScheduledStudent(supabase, session.teacher_id);
    if (scheduledStudentId) {
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

async function findOrCreateZoomSession(
  supabase: any,
  licenseId: string,
  meetingUuid: string | null,
  startTime: string,
): Promise<any | null> {
  if (meetingUuid) {
    const { data: sessionByMeeting } = await supabase
      .from("live_sessions")
        .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
      .eq("zoom_meeting_uuid", meetingUuid)
        .in("status", ["live", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionByMeeting) return sessionByMeeting;
  }

  const recentCutoff = new Date(new Date(startTime).getTime() - 2 * 60 * 60 * 1000).toISOString();
  const query = supabase
    .from("live_sessions")
    .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
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
    return activeSession;
  }

  const teacherId = await getMonitorTeacherId(supabase, licenseId);
  if (!teacherId) {
    console.log("No teacher/admin available to create monitor session for license:", licenseId);
    return null;
  }

  const { data: createdSession, error } = await supabase
    .from("live_sessions")
    .insert({
      teacher_id: teacherId,
      license_id: licenseId,
      scheduled_start: startTime,
      actual_start: startTime,
      status: "live",
      zoom_meeting_uuid: meetingUuid,
      recording_status: "pending",
    })
    .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
    .single();

  if (error || !createdSession) {
    if (error?.code === "23505") {
      let query = supabase
        .from("live_sessions")
        .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
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
    console.error("Error inserting Zoom attendance log:", error, payload);
  }
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
    const zoomSignature = req.headers.get("x-zm-signature");
    const zoomTimestamp = req.headers.get("x-zm-request-timestamp");
    const secretToken = Deno.env.get("ZOOM_SECRET_TOKEN");

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

    const event: ZoomEvent = JSON.parse(body);
    console.log("=== ZOOM WEBHOOK ===", event.event, new Date().toISOString());

    // Handle URL validation challenge
    if (event.event === "endpoint.url_validation") {
      const plainToken = event.payload.plainToken;
      const encryptedToken = createHmac("sha256", secretToken)
        .update(plainToken || "")
        .digest("hex");
      console.log("Responding to Zoom URL validation challenge");
      return new Response(
        JSON.stringify({ plainToken, encryptedToken }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hostId = event.payload.object?.host_id;
    const meetingUuidTop = event.payload.object?.uuid || null;
    const meetingIdTop = event.payload.object?.id || null;

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

          // Activate any scheduled session that was pre-created (e.g. by student early join)
          const { data: pendingSession } = await supabase
            .from("live_sessions")
            .select("id, license_id")
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
            console.log("Activated pending session:", pendingSession.id);
          } else {
            // Also check sessions without license_id (teacher may have created session before license assignment)
            const { data: unlinkedSession } = await supabase
              .from("live_sessions")
              .select("id")
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
              console.log("Linked and activated unlinked session:", unlinkedSession.id);
            } else {
              await findOrCreateZoomSession(supabase, license.id, meetingUuidTop, startedAt);
            }
          }
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
            .select("id, teacher_id, assignment_id, schedule_id, actual_start")
            .eq("license_id", license.id)
            .in("status", ["live", "scheduled"]);

          const endedAt = event.payload.object?.end_time || eventTime(event);
          await supabase.from("zoom_licenses").update({ status: "available" }).eq("id", license.id);
          await supabase
            .from("live_sessions")
            .update({ status: "completed", actual_end: endedAt, recording_status: "pending" })
            .eq("license_id", license.id)
            .in("status", ["live", "scheduled"]);
          console.log("License released, sessions completed:", license.id);

          // Auto-mark absent students
          for (const session of (liveSessions || [])) {
            if (!session.assignment_id && !session.schedule_id) continue;
            if (!session.teacher_id) continue;
            const { data: assignments } = await supabase
              .from("student_teacher_assignments")
              .select("student_id")
              .eq("teacher_id", session.teacher_id)
              .eq("status", "active");
            if (!assignments || assignments.length === 0) continue;

            const { data: joinLogs } = await supabase
              .from("zoom_attendance_logs")
              .select("user_id")
              .eq("session_id", session.id);
            const joinedUserIds = new Set((joinLogs || []).filter((l: any) => l.user_id).map((l: any) => l.user_id));
            const absentStudents = assignments.filter(a => !joinedUserIds.has(a.student_id));

            if (absentStudents.length > 0) {
              const today = new Date().toISOString().split("T")[0];
              const classTime = session.actual_start
                ? new Date(session.actual_start).toTimeString().slice(0, 5)
                : "00:00";
              const absentRecords = absentStudents.map(a => ({
                student_id: a.student_id,
                teacher_id: session.teacher_id,
                class_date: today,
                class_time: classTime,
                status: "student_absent",
                duration_minutes: 30,
                lesson_notes: `Auto-marked absent — did not join Zoom session ${session.id}`,
              }));
              const { error: insertErr } = await supabase.from("attendance").insert(absentRecords);
              if (insertErr) {
                console.error("Error auto-marking absents:", insertErr);
              } else {
                console.log(`Auto-marked ${absentStudents.length} students absent for session ${session.id}`);
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

        // If session is still 'scheduled', activate it now (first person joined)
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
            .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
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
            .select("id, teacher_id, actual_start, student_id, status, assignment_id, schedule_id")
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
          zoom_event_type: event.event,
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
            .select("id")
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
