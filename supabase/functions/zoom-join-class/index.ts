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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const p = (await req.json()) as Payload;
    if (!p.teacherId) return jsonResp({ error: "teacherId required" }, 400);

    // Determine role
    const { data: roleRows } = await service.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isTeacher = userId === p.teacherId && roles.includes("teacher");
    const isStudent = roles.includes("student");
    const isAdmin = roles.includes("admin") || roles.includes("super_admin") || roles.includes("admin_academic") || roles.includes("admin_division");

    if (!isTeacher && !isStudent && !isAdmin) {
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

    // Locate or create the live_sessions row.
    let session: any = null;

    if (p.liveSessionId) {
      const { data } = await service
        .from("live_sessions")
        .select("id, status, license_id, teacher_id, student_id, assignment_id, scheduled_start")
        .eq("id", p.liveSessionId)
        .maybeSingle();
      session = data;
    }

    if (!session && p.assignmentId) {
      const { data } = await service
        .from("live_sessions")
        .select("id, status, license_id, teacher_id, student_id, assignment_id, scheduled_start")
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
        })
        .select("id, status, license_id, teacher_id, student_id, assignment_id, scheduled_start")
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

    // If no license yet: teacher/admin allocates from pool; student waits.
    if (!session.license_id) {
      if (!(isTeacher || isAdmin)) {
        return jsonResp({
          ready: false,
          sessionId: session.id,
          message: "Waiting for teacher to open the class room.",
        });
      }

      // Allocate + reserve a license via existing DB helper
      const { data: reserved, error: rpcErr } = await service.rpc("get_and_reserve_license", {
        _teacher_id: p.teacherId,
        _session_id: session.id,
      });
      if (rpcErr || !reserved || (Array.isArray(reserved) && reserved.length === 0)) {
        return jsonResp({
          ready: false,
          sessionId: session.id,
          message: rpcErr?.message || "All Zoom rooms are currently occupied. Try again shortly.",
        });
      }
      const row = Array.isArray(reserved) ? reserved[0] : reserved;
      return jsonResp({
        ready: true,
        sessionId: session.id,
        joinUrl: row.meeting_link,
      });
    }

    // License already assigned — fetch its link
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
      joinUrl: license.meeting_link,
    });
  } catch (e) {
    return jsonResp({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
