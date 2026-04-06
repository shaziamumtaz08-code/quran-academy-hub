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
    console.log("=== ZOOM WEBHOOK RECEIVED ===", event.event, new Date().toISOString());

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
        const meetingId = event.payload.object?.uuid || event.payload.object?.id;
        console.log("Meeting started:", meetingId, "host:", hostId);
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();
        if (license) {
          await supabase.from("zoom_licenses").update({ status: "busy", last_used_at: new Date().toISOString() }).eq("id", license.id);
          console.log("License marked busy:", license.id);
        }
        break;
      }

      case "meeting.ended": {
        const meetingId = event.payload.object?.uuid || event.payload.object?.id;
        console.log("Meeting ended:", meetingId, "host:", hostId);
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
          console.log("License released and sessions completed:", license.id);

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
            const joinedUserIds = new Set((joinLogs || []).map((l: any) => l.user_id));
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
        if (!participant?.email) { console.log("No participant email in join event"); break; }
        console.log("Participant joined:", participant.user_name, participant.email);

        const { data: user } = await supabase.from("profiles").select("id").eq("email", participant.email).maybeSingle();
        if (!user) { console.log("User not found for email:", participant.email); break; }

        const { data: license } = await supabase.from("zoom_licenses").select("id").eq("host_id", hostId).maybeSingle();
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, actual_start")
          .eq("status", "live")
          .eq("license_id", license?.id)
          .maybeSingle();
        if (!session) { console.log("No active session found for license:", license?.id); break; }

        const joinTime = new Date(participant.join_time || new Date().toISOString());
        let isLate = false;
        let lateMinutes = 0;
        if (session.actual_start) {
          lateMinutes = Math.floor((joinTime.getTime() - new Date(session.actual_start).getTime()) / 60000);
          isLate = lateMinutes > 10;
        }

        await supabase.from("zoom_attendance_logs").insert({
          session_id: session.id,
          user_id: user.id,
          action: "join_intent",
          join_time: joinTime.toISOString(),
          timestamp: new Date().toISOString(),
        });
        console.log(`Join logged: ${user.id}, Late: ${isLate} (${lateMinutes} mins)`);

        if (isLate) {
          const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
          if (roleData?.role === "student") {
            const { data: parentLink } = await supabase.from("student_parent_links").select("parent_id").eq("student_id", user.id).maybeSingle();
            if (parentLink) {
              await supabase.from("notification_queue").insert({
                recipient_id: parentLink.parent_id,
                recipient_type: "parent",
                notification_type: "late_join",
                title: "Late Entry Alert",
                message: `${participant.user_name} joined class ${lateMinutes} minutes late.`,
                metadata: { user_id: user.id, late_minutes: lateMinutes, session_id: session.id, status: "Late" },
              });
            }
          }
        }
        break;
      }

      case "meeting.participant_left": {
        const participant = event.payload.object?.participant;
        if (!participant?.email) { console.log("No participant email in leave event"); break; }
        console.log("Participant left:", participant.user_name, participant.email);

        const { data: user } = await supabase.from("profiles").select("id").eq("email", participant.email).maybeSingle();
        if (!user) { console.log("User not found for email:", participant.email); break; }

        const { data: license } = await supabase.from("zoom_licenses").select("id").eq("host_id", hostId).maybeSingle();
        const { data: session } = await supabase.from("live_sessions").select("id").eq("license_id", license?.id).maybeSingle();
        if (!session) { console.log("No session found for license:", license?.id); break; }

        const { data: joinLog } = await supabase
          .from("zoom_attendance_logs")
          .select("id, join_time, total_duration_minutes")
          .eq("session_id", session.id)
          .eq("user_id", user.id)
          .eq("action", "join_intent")
          .is("leave_time", null)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!joinLog) { console.log("No matching join record found for user:", user.id); break; }

        const leaveTime = new Date(participant.leave_time || new Date().toISOString());
        const joinTime = new Date(joinLog.join_time);
        const sessionMinutes = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 60000);
        const previousTotal = joinLog.total_duration_minutes || 0;
        const newTotal = previousTotal + sessionMinutes;

        await supabase.from("zoom_attendance_logs").update({
          action: "leave",
          leave_time: leaveTime.toISOString(),
          total_duration_minutes: newTotal,
        }).eq("id", joinLog.id);
        console.log(`Leave logged: ${user.id}, Session: ${sessionMinutes}min, Total: ${newTotal}min`);

        if (sessionMinutes < 25) {
          const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
          if (roleData?.role === "student") {
            const { data: parentLink } = await supabase.from("student_parent_links").select("parent_id").eq("student_id", user.id).maybeSingle();
            if (parentLink) {
              await supabase.from("notification_queue").insert({
                recipient_id: parentLink.parent_id,
                recipient_type: "parent",
                notification_type: "short_session",
                title: "Short Session Alert",
                message: `${participant.user_name} left class after ${sessionMinutes} minutes (Total: ${newTotal} mins).`,
                metadata: { user_id: user.id, session_minutes: sessionMinutes, total_minutes: newTotal, session_id: session.id },
              });
            }
          }
        }
        break;
      }

      case "recording.completed": {
        console.log("=== RECORDING COMPLETED ===", hostId);
        const recordingFiles = event.payload.object?.recording_files || [];
        const recordingPassword = event.payload.object?.password || null;

        // Find the most recent completed session for this host
        const { data: license } = await supabase
          .from("zoom_licenses")
          .select("id")
          .eq("host_id", hostId)
          .maybeSingle();

        if (!license) {
          console.log("No license found for host:", hostId);
          break;
        }

        const { data: session } = await supabase
          .from("live_sessions")
          .select("id")
          .eq("license_id", license.id)
          .eq("status", "completed")
          .order("actual_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) {
          console.log("No completed session found for license:", license.id);
          break;
        }

        // Insert each recording file into session_recordings
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
          if (recErr) {
            console.error("Error inserting recordings:", recErr);
          } else {
            console.log(`Inserted ${recordingInserts.length} recording(s) for session ${session.id}`);
          }
        }

        // Find first MP4 play_url for the session's recording_link
        const mp4File = recordingFiles.find((f: any) => f.file_type === "MP4");
        const playUrl = mp4File?.play_url || mp4File?.download_url || null;

        await supabase.from("live_sessions").update({
          recording_status: "ready",
          recording_link: playUrl,
          recording_password: recordingPassword,
          recording_fetched_at: new Date().toISOString(),
        }).eq("id", session.id);

        console.log("Recording saved to session:", session.id, "files:", recordingInserts.length);
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
