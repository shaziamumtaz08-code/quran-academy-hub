import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ClaimPayload = {
  teacherId: string;
  studentId?: string | null;
  assignmentId?: string | null;
  scheduleId?: string | null;
  licenseId?: string | null;
  scheduledStart?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as ClaimPayload;
    if (!payload.teacherId) {
      return new Response(JSON.stringify({ error: "teacherId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.studentId && payload.studentId !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Student mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.assignmentId) {
      const { data: assignment } = await serviceClient
        .from("student_teacher_assignments")
        .select("id, student_id, teacher_id, status")
        .eq("id", payload.assignmentId)
        .maybeSingle();

      if (!assignment || assignment.status !== "active" || assignment.teacher_id !== payload.teacherId || assignment.student_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Assignment not valid for this user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const existingQuery = serviceClient
      .from("live_sessions")
      .select("id, status, license_id")
      .eq("teacher_id", payload.teacherId)
      .in("status", ["scheduled", "live"])
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: existingSessions } = payload.assignmentId
      ? await existingQuery.eq("assignment_id", payload.assignmentId)
      : await existingQuery;

    const existingSession = existingSessions?.[0];
    if (existingSession) {
      const updatePatch: Record<string, string | null> = {};
      if (!existingSession.license_id && payload.licenseId) updatePatch.license_id = payload.licenseId;
      if (payload.studentId) updatePatch.student_id = payload.studentId;

      if (Object.keys(updatePatch).length > 0) {
        await serviceClient.from("live_sessions").update(updatePatch).eq("id", existingSession.id);
      }

      return new Response(JSON.stringify({ sessionId: existingSession.id, reused: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: createdSession, error: createError } = await serviceClient
      .from("live_sessions")
      .insert({
        teacher_id: payload.teacherId,
        student_id: payload.studentId || null,
        assignment_id: payload.assignmentId || null,
        schedule_id: payload.scheduleId || null,
        license_id: payload.licenseId || null,
        scheduled_start: payload.scheduledStart || new Date().toISOString(),
        status: "scheduled",
      })
      .select("id")
      .single();

    if (createError || !createdSession) {
      return new Response(JSON.stringify({ error: createError?.message || "Could not create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sessionId: createdSession.id, reused: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});