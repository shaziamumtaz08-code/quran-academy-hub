// Shared (pooled) Zoom seats: register/unregister pool accounts, read their
// booked schedules for availability, create demo/group/quick meetings on a
// chosen seat (cloud recording when the seat supports it), and list recordings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function zoomToken(admin: any) {
  let accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  let clientId = Deno.env.get("ZOOM_CLIENT_ID");
  let clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!accountId || !clientId || !clientSecret) {
    const { data: cred } = await admin
      .from("zoom_accounts")
      .select("zoom_account_id_cred, zoom_client_id, zoom_client_secret")
      .not("zoom_account_id_cred", "is", null)
      .not("zoom_client_secret", "is", null)
      .order("last_validated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    accountId = accountId || cred?.zoom_account_id_cred;
    clientId = clientId || cred?.zoom_client_id;
    clientSecret = clientSecret || cred?.zoom_client_secret;
  }
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom S2S credentials are not configured.");
  }

  const resp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    { method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` } },
  );
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`Zoom rejected credentials: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

async function zoomGet(token: string, path: string) {
  const resp = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}

async function seatBusy(token: string, userId: string) {
  const meetings: any[] = [];
  for (const type of ["scheduled", "upcoming_meetings"]) {
    let next = "";
    do {
      const { ok, body: b } = await zoomGet(
        token,
        `/users/${userId}/meetings?type=${type}&page_size=300${next ? `&next_page_token=${next}` : ""}`,
      );
      if (!ok) break;
      for (const m of b.meetings || []) {
        if (!meetings.some((x) => x.id === m.id)) meetings.push(m);
      }
      next = b.next_page_token || "";
    } while (next);
  }
  return meetings
    .filter((m) => m.start_time)
    .map((m) => {
      const start = new Date(m.start_time);
      const mins = Number(m.duration || 40);
      return {
        id: String(m.id),
        topic: m.topic || "Zoom meeting",
        start: start.toISOString(),
        end: new Date(start.getTime() + mins * 60000).toISOString(),
        duration: mins,
        join_url: m.join_url || null,
      };
    })
    .sort((a, b2) => a.start.localeCompare(b2.start));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roleList = (roles || []).map((r: any) => String(r.role));
    const isAdmin = roleList.some((r) =>
      ["super_admin", "admin"].includes(r) || r.startsWith("admin_")
    );
    const isTeacher = roleList.includes("teacher");
    if (!isAdmin && !isTeacher) return json({ error: "Access denied" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action: string = body?.action || "pool_availability";

    // Configuration actions are admin-only. Teachers may check + book.
    const adminOnly = ["register_shared", "unregister_shared"];
    if (adminOnly.includes(action) && !isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }

    // ---------- register / refresh a pool seat ----------
    if (action === "register_shared") {
      const email = String(body?.email || "").trim();
      if (!email) return json({ error: "email is required" }, 400);
      const purposes: string[] = Array.isArray(body?.purposes) && body.purposes.length
        ? body.purposes
        : ["demo", "group", "quick"];

      const token = await zoomToken(admin);
      const { ok, status, body: zu } = await zoomGet(token, `/users/${encodeURIComponent(email)}`);
      if (!ok) {
        return json({
          error: "That email is not a user inside your Zoom account",
          status,
          details: zu,
        }, status);
      }

      const { data: existing } = await admin
        .from("zoom_accounts")
        .select("id")
        .ilike("zoom_account_email", email)
        .maybeSingle();

      const payload: any = {
        zoom_account_email: zu.email,
        zoom_user_id: zu.id,
        tier: zu.type === 2 ? "licensed" : "free",
        meeting_link: zu.personal_meeting_url || null,
        is_active: true,
        is_shared: true,
        teacher_id: null,
        shared_purposes: purposes,
        auto_record: zu.type === 2,
        display_label: body?.label || `Pool seat — ${zu.email}`,
        last_validated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await admin.from("zoom_accounts").update(payload).eq("id", existing.id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin.from("zoom_accounts").insert(payload);
        if (error) return json({ error: error.message }, 400);
      }

      return json({
        success: true,
        account: { email: zu.email, host_id: zu.id, tier: payload.tier, purposes },
      });
    }

    if (action === "unregister_shared") {
      const id = String(body?.account_id || "");
      if (!id) return json({ error: "account_id is required" }, 400);
      const { error } = await admin.from("zoom_accounts").update({ is_shared: false }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // Resolve the pool
    const { data: pool } = await admin
      .from("zoom_accounts")
      .select("id, zoom_account_email, zoom_user_id, tier, shared_purposes, auto_record, display_label")
      .eq("is_shared", true)
      .eq("is_active", true)
      .order("tier", { ascending: false });

    const seats = (pool || []).filter((s: any) => s.zoom_user_id);
    if (!seats.length) {
      return json({ error: "No shared Zoom seats registered yet.", needs_registration: true, seats: [] }, 400);
    }

    const token = await zoomToken(admin);

    // ---------- pool availability ----------
    if (action === "pool_availability" || action === "availability") {
      const checkStart = body?.check_start ? new Date(body.check_start).getTime() : null;
      const checkEnd = checkStart ? checkStart + Number(body?.check_duration || 40) * 60000 : null;

      const results = await Promise.all(seats.map(async (seat: any) => {
        const busy = await seatBusy(token, seat.zoom_user_id);
        let conflict: any = null;
        if (checkStart && checkEnd) {
          conflict = busy.find((b3) => {
            const bs = new Date(b3.start).getTime();
            const be = new Date(b3.end).getTime();
            return checkStart < be && checkEnd > bs;
          }) || null;
        }
        return { seat, busy, conflict, available: checkStart ? !conflict : null };
      }));

      return json({ success: true, seats: results });
    }

    // ---------- recordings on a pool seat ----------
    if (action === "recordings") {
      const seat = seats.find((s: any) => s.id === body?.account_id) || seats[0];
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 86400000);
      const { ok, status, body: b } = await zoomGet(
        token,
        `/users/${seat.zoom_user_id}/recordings?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&page_size=100`,
      );
      if (!ok) return json({ error: "Failed to read recordings", status, details: b }, status);
      const recordings = (b.meetings || []).map((m: any) => ({
        id: String(m.uuid || m.id),
        topic: m.topic,
        start_time: m.start_time,
        duration: m.duration,
        share_url: m.share_url || null,
        play_url: (m.recording_files || []).find((f: any) => f.play_url)?.play_url || null,
      }));
      return json({ success: true, seat, recordings });
    }

    // ---------- create a meeting on a chosen pool seat ----------
    if (action === "create_meeting") {
      const startTime = String(body?.start_time || "");
      const duration = Number(body?.duration || 40);
      if (!startTime) return json({ error: "start_time is required" }, 400);

      const seat = seats.find((s: any) => s.id === body?.account_id) || seats[0];
      const meetingType = ["demo", "group", "quick", "class"].includes(String(body?.meeting_type))
        ? String(body.meeting_type)
        : body?.demo_session_id
          ? "demo"
          : "quick";

      const { data: actor } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();

      const auditBase = {
        zoom_account_id: seat.id,
        seat_email: seat.zoom_account_email,
        seat_label: seat.display_label,
        seat_tier: seat.tier,
        booked_by: userData.user.id,
        booked_by_name: actor?.full_name || userData.user.email || null,
        booked_by_role: isAdmin ? "admin" : "teacher",
        meeting_type: meetingType,
        topic: body?.topic || "Al Quran Time Academy session",
        start_time: new Date(startTime).toISOString(),
        duration_minutes: duration,
        timezone: body?.timezone || "Asia/Karachi",
        auto_record: !!seat.auto_record,
        course_class_id: body?.course_class_id || null,
        demo_session_id: body?.demo_session_id || null,
      };

      const resp = await fetch(`https://api.zoom.us/v2/users/${seat.zoom_user_id}/meetings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: auditBase.topic,
          type: 2,
          start_time: new Date(startTime).toISOString().replace(/\.\d{3}Z$/, "Z"),
          duration,
          timezone: auditBase.timezone,
          agenda: body?.agenda || undefined,
          settings: {
            join_before_host: true,
            jbh_time: 5,
            waiting_room: false,
            auto_recording: seat.auto_record ? "cloud" : "none",
            mute_upon_entry: true,
            approval_type: 2,
          },
        }),
      });
      const created = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        await admin.from("zoom_booking_audit_log").insert({
          ...auditBase,
          status: "failed",
          error_reason: typeof created?.message === "string" ? created.message : `Zoom error ${resp.status}`,
          metadata: { zoom_status: resp.status },
        });
        return json({ error: "Zoom could not create the meeting", status: resp.status, details: created }, resp.status);
      }

      if (body?.demo_session_id) {
        await admin
          .from("demo_sessions")
          .update({ zoom_link: created.join_url })
          .eq("id", body.demo_session_id);
      }

      await admin.from("zoom_booking_audit_log").insert({
        ...auditBase,
        status: "created",
        zoom_meeting_id: String(created.id),
        join_url: created.join_url || null,
      });

      return json({
        success: true,
        meeting: {
          id: String(created.id),
          topic: created.topic,
          start_time: created.start_time,
          duration: created.duration,
          join_url: created.join_url,
          start_url: created.start_url,
          seat: seat.zoom_account_email,
          recording: seat.auto_record ? "cloud" : "off",
        },
      });
    }


    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
