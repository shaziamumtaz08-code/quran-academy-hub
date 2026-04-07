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

    switch (event.event) {
      case "meeting.started": {
        console.log("Meeting started, host:", hostId);
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();
        if (license) {
          await supabase.from("zoom_licenses").update({ status: "busy", last_used_at: new Date().toISOString() }).eq("id", license.id);
          console.log("License marked busy:", license.id);

          // Activate any scheduled session that was pre-created (e.g. by student early join)
          const { data: pendingSession } = await supabase
            .from("live_sessions")
            .select("id, license_id")
            .eq("license_id", license.id)
            .eq("status", "scheduled")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pendingSession) {
            await supabase.from("live_sessions").update({
              status: "live",
              actual_start: new Date().toISOString(),
            }).eq("id", pendingSession.id);
            console.log("Activated pending session:", pendingSession.id);
          } else {
            // Also check sessions without license_id (teacher may have created session before license assignment)
            const { data: unlinkedSession } = await supabase
              .from("live_sessions")
              .select("id")
              .is("license_id", null)
              .eq("status", "scheduled")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (unlinkedSession) {
              await supabase.from("live_sessions").update({
                status: "live",
                actual_start: new Date().toISOString(),
                license_id: license.id,
              }).eq("id", unlinkedSession.id);
              console.log("Linked and activated unlinked session:", unlinkedSession.id);
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
          const { data: liveSessions } = await supabase
            .from("live_sessions")
            .select("id, teacher_id, assignment_id, actual_start")
            .eq("license_id", license.id)
            .eq("status", "live");

          await supabase.from("zoom_licenses").update({ status: "available" }).eq("id", license.id);
          await supabase
            .from("live_sessions")
            .update({ status: "completed", actual_end: new Date().toISOString(), recording_status: "pending" })
            .eq("license_id", license.id)
            .eq("status", "live");
          console.log("License released, sessions completed:", license.id);

          // Auto-mark absent students
          for (const session of (liveSessions || [])) {
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
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) {
          console.log("No license found for host_id:", hostId);
          break;
        }

        // Step 2: Find the active live OR scheduled session for this license
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, teacher_id, actual_start, student_id, status")
          .eq("license_id", license.id)
          .in("status", ["live", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) {
          console.log("No active session for license:", license.id, "— logging raw event only");
          await supabase.from("zoom_attendance_logs").insert({
            session_id: null,
            user_id: null,
            action: "join_intent",
            join_time: new Date(participant?.join_time || new Date().toISOString()).toISOString(),
            timestamp: new Date().toISOString(),
            participant_name: pName,
            participant_email: pEmail,
            role: "unknown",
          });
          break;
        }

        // If session is still 'scheduled', activate it now (first person joined)
        if (session.status === "scheduled") {
          await supabase.from("live_sessions").update({
            status: "live",
            actual_start: new Date().toISOString(),
          }).eq("id", session.id);
          session.actual_start = new Date().toISOString();
          console.log("Session activated by participant join:", session.id);
        }

        // Step 3: Determine if this is the teacher or student
        // Check existing join logs for this session to see who already joined
        const { data: existingLogs } = await supabase
          .from("zoom_attendance_logs")
          .select("id, user_id, role")
          .eq("session_id", session.id)
          .eq("action", "join_intent")
          .is("leave_time", null);

        const teacherAlreadyJoined = (existingLogs || []).some((l: any) => l.role === "teacher");

        let matchedUserId: string | null = null;
        let matchedRole = "unknown";

        if (!teacherAlreadyJoined) {
          // First participant → teacher
          matchedUserId = session.teacher_id;
          matchedRole = "teacher";
          console.log("First participant → teacher:", matchedUserId);
        } else {
          // Second participant → find scheduled student
          matchedRole = "student";
          const studentId = await findScheduledStudent(supabase, session.teacher_id);
          if (studentId) {
            matchedUserId = studentId;
            console.log("Second participant → student:", matchedUserId);

            // Update live_session with student_id
            await supabase.from("live_sessions")
              .update({ student_id: studentId })
              .eq("id", session.id);
          } else {
            console.log("Second participant → could not match student from schedule");
          }
        }

        const joinTime = new Date(participant?.join_time || new Date().toISOString());
        let isLate = false;
        let lateMinutes = 0;
        if (session.actual_start) {
          lateMinutes = Math.floor((joinTime.getTime() - new Date(session.actual_start).getTime()) / 60000);
          isLate = lateMinutes > 10;
        }

        await supabase.from("zoom_attendance_logs").insert({
          session_id: session.id,
          user_id: matchedUserId,
          action: "join_intent",
          join_time: joinTime.toISOString(),
          timestamp: new Date().toISOString(),
          participant_name: pName,
          participant_email: pEmail,
          role: matchedRole,
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
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) { console.log("No license for host:", hostId); break; }

        // Find session (could be live or recently completed)
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, teacher_id")
          .eq("license_id", license.id)
          .in("status", ["live", "completed"])
          .order("actual_start", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) { console.log("No session found for license:", license.id); break; }

        // Find the most recent unresolved join log for this session
        // Match by participant_name since we may not have user_id
        const { data: joinLog } = await supabase
          .from("zoom_attendance_logs")
          .select("id, user_id, join_time, total_duration_minutes, role, participant_name, participant_email")
          .eq("session_id", session.id)
          .eq("action", "join_intent")
          .is("leave_time", null)
          .order("timestamp", { ascending: false })
          .limit(5);

        // Try to match by participant name/email
        let matchedLog = null;
        if (joinLog && joinLog.length > 0) {
          // If only one unresolved join, use it
          if (joinLog.length === 1) {
            matchedLog = joinLog[0];
          } else {
            matchedLog = joinLog.find((entry: any) => {
              const sameName = entry.participant_name && entry.participant_name === pName;
              const sameEmail = entry.participant_email && pEmail && entry.participant_email === pEmail;
              return sameName || sameEmail;
            }) || joinLog[0];
          }
        }

        if (!matchedLog) {
          console.log("No matching join record for leave event, session:", session.id);
          break;
        }

        const leaveTime = new Date(participant?.leave_time || new Date().toISOString());
        const joinTime = new Date(matchedLog.join_time);
        const sessionMinutes = Math.max(1, Math.ceil((leaveTime.getTime() - joinTime.getTime()) / 60000));
        const previousTotal = matchedLog.total_duration_minutes || 0;
        const newTotal = previousTotal + sessionMinutes;

        await supabase.from("zoom_attendance_logs").update({
          action: "leave",
          leave_time: leaveTime.toISOString(),
          total_duration_minutes: newTotal,
          participant_name: pName,
          participant_email: pEmail,
        }).eq("id", matchedLog.id);
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
              metadata: { user_id: matchedLog.user_id, session_minutes: sessionMinutes, total_minutes: newTotal, session_id: session.id },
            });
          }
        }
        break;
      }

      case "recording.completed": {
        console.log("=== RECORDING COMPLETED ===", hostId);
        const recordingFiles = event.payload.object?.recording_files || [];
        const recordingPassword = event.payload.object?.password || null;

        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) { console.log("No license for host:", hostId); break; }

        const { data: session } = await supabase
          .from("live_sessions")
          .select("id")
          .eq("license_id", license.id)
          .eq("status", "completed")
          .order("actual_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) { console.log("No completed session for license:", license.id); break; }

        const recordingInserts = recordingFiles.map((file: any) => ({
          session_id: session.id,
          recording_type: file.recording_type || 'unknown',
          play_url: file.play_url || null,
          download_url: file.download_url || null,
          password: recordingPassword,
          file_size_mb: file.file_size ? Math.round(file.file_size / 1048576 * 100) / 100 : null,
          file_type: file.file_type || 'MP4',
          recording_start: file.recording_start || null,
          recording_end: file.recording_end || null,
          status: 'available',
        }));

        if (recordingInserts.length > 0) {
          const { error: recErr } = await supabase.from("session_recordings").insert(recordingInserts);
          if (recErr) console.error("Error inserting recordings:", recErr);
          else console.log(`Inserted ${recordingInserts.length} recording(s) for session ${session.id}`);
        }

        const mp4File = recordingFiles.find((f: any) => f.file_type === "MP4");
        const playUrl = mp4File?.play_url || mp4File?.download_url || null;

        await supabase.from("live_sessions").update({
          recording_status: "ready",
          recording_link: playUrl,
          recording_password: recordingPassword,
          recording_fetched_at: new Date().toISOString(),
        }).eq("id", session.id);

        console.log("Recording saved to session:", session.id);
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
