import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getServiceAccount, getAccessToken, sendToToken } from "../_shared/fcm.ts";

const COOLDOWN_SECONDS = 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return json({ error: "Service not configured" }, 500);
    }

    // 1. Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Authentication required" }, 401);

    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authed.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid session" }, 401);

    // Validate input
    const body = await req.json().catch(() => ({}));
    const schedule_id = typeof body?.schedule_id === "string" ? body.schedule_id : "";
    const occurrence_date = typeof body?.occurrence_date === "string" ? body.occurrence_date : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schedule_id)) {
      return json({ error: "schedule_id must be a valid uuid" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrence_date) || Number.isNaN(Date.parse(occurrence_date))) {
      return json({ error: "occurrence_date must be a valid YYYY-MM-DD date" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 2. Resolve teacher + student via student_teacher_assignments
    const { data: schedule, error: sErr } = await admin
      .from("schedules")
      .select("id, assignment_id")
      .eq("id", schedule_id)
      .maybeSingle();
    if (sErr || !schedule?.assignment_id) return json({ error: "Schedule not found" }, 404);

    const { data: assignment } = await admin
      .from("student_teacher_assignments")
      .select("id, student_id, teacher_id, subject_id")
      .eq("id", schedule.assignment_id)
      .maybeSingle();
    if (!assignment) return json({ error: "Assignment not found" }, 404);

    // 3. Determine sender role / recipient
    let sender_role: "teacher" | "student";
    let recipient_id: string;
    if (user.id === assignment.teacher_id) {
      sender_role = "teacher";
      recipient_id = assignment.student_id;
    } else if (user.id === assignment.student_id) {
      sender_role = "student";
      recipient_id = assignment.teacher_id;
    } else {
      return json({ error: "Forbidden" }, 403);
    }
    if (!recipient_id) return json({ error: "No counterpart on this class" }, 404);

    // 4. Cooldown check
    const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
    const { data: recent } = await admin
      .from("class_pings")
      .select("created_at")
      .eq("schedule_id", schedule_id)
      .eq("occurrence_date", occurrence_date)
      .eq("sender_id", user.id)
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      const retryAfter = Math.max(1, Math.ceil(COOLDOWN_SECONDS - elapsed));
      return json(
        { success: false, cooldown: true, retryAfterSeconds: retryAfter,
          error: `Please wait ${retryAfter}s before pinging again.` },
        429,
      );
    }

    // 5. Insert ping
    const { data: ping, error: iErr } = await admin
      .from("class_pings")
      .insert({
        schedule_id,
        occurrence_date,
        sender_id: user.id,
        sender_role,
        recipient_id,
      })
      .select("id")
      .single();
    if (iErr || !ping) return json({ error: iErr?.message ?? "Failed to record ping" }, 500);

    // 6. Realtime broadcast (fire and forget)
    let realtime_sent = false;
    try {
      const channelName = `class-ping:${schedule_id}:${occurrence_date}`;
      const channel = admin.channel(channelName, { config: { broadcast: { ack: false } } });
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        channel.subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      await channel.send({
        type: "broadcast",
        event: "ping",
        payload: { recipientId: recipient_id, senderRole: sender_role, scheduleId: schedule_id },
      });
      realtime_sent = true;
      await admin.removeChannel(channel);
    } catch (e) {
      console.warn("[send-class-ping] realtime broadcast failed", e);
    }

    // 7. Push fallback (best-effort)
    let push_sent = false;
    try {
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", recipient_id);

      if (tokens && tokens.length > 0) {
        const sa = getServiceAccount();
        if (!sa) {
          console.warn("[send-class-ping] FCM_SERVICE_ACCOUNT_JSON not configured");
        } else {
          const { data: senderProfile } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          let subjectName: string | null = null;
          if (assignment.subject_id) {
            const { data: subj } = await admin
              .from("subjects")
              .select("name")
              .eq("id", assignment.subject_id)
              .maybeSingle();
            subjectName = subj?.name ?? null;
          }
          const senderName = senderProfile?.full_name?.trim();
          const bodyText = senderName
            ? `${senderName} is ready for your ${subjectName ? subjectName + " " : ""}class — join now!`
            : "Your class partner is ready — join now!";

          const accessToken = await getAccessToken(sa);
          for (const t of tokens) {
            const res = await sendToToken(sa, accessToken, t.token, "Class ping", bodyText, {
              type: "class_ping",
              scheduleId: schedule_id,
              occurrenceDate: occurrence_date,
            });
            if (res.ok) push_sent = true;
            else if (res.stale) {
              await admin.from("push_tokens").delete().eq("token", t.token);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[send-class-ping] push fallback failed", e);
    }

    if (realtime_sent || push_sent) {
      await admin
        .from("class_pings")
        .update({ realtime_sent, push_sent })
        .eq("id", ping.id);
    }

    return json({ success: true, pingId: ping.id, realtime_sent, push_sent });
  } catch (e) {
    console.error("[send-class-ping] unexpected error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
