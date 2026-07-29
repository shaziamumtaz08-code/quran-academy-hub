// Shared (pooled) Zoom account operations: register the licensed academy seat,
// read its booked schedule for availability checks, and create demo/group
// meetings on it with cloud recording enabled.
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
    const allowed = (roles || []).some((r: any) =>
      ["super_admin", "admin"].includes(r.role) || String(r.role).startsWith("admin_")
    );
    if (!allowed) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action: string = body?.action || "availability";

    // ---------- register / refresh a shared seat ----------
    if (action === "register_shared") {
      const email = String(body?.email || "").trim();
      if (!email) return json({ error: "email is required" }, 400);
      const purposes: string[] = Array.isArray(body?.purposes) && body.purposes.length
        ? body.purposes
        : ["demo", "group"];

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
        shared_purposes: purposes,
        auto_record: zu.type === 2,
        display_label: body?.label || "Academy shared seat",
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

    // Resolve the shared seat used for every remaining action
    const { data: shared } = await admin
      .from("zoom_accounts")
      .select("id, zoom_account_email, zoom_user_id, tier, shared_purposes, auto_record, display_label")
      .eq("is_shared", true)
      .eq("is_active", true)
      .order("tier", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!shared?.zoom_user_id) {
      return json({ error: "No shared Zoom seat is registered yet.", needs_registration: true }, 400);
    }

    const token = await zoomToken(admin);

    // ---------- read booked schedule ----------
    if (action === "availability") {
      const meetings: any[] = [];
      for (const type of ["scheduled", "upcoming_meetings"]) {
        let next = "";
        do {
          const { ok, status, body: b } = await zoomGet(
            token,
            `/users/${shared.zoom_user_id}/meetings?type=${type}&page_size=300${next ? `&next_page_token=${next}` : ""}`,
          );
          if (!ok) {
            return json({ error: "Failed to read Zoom schedule", status, details: b }, status);
          }
          for (const m of b.meetings || []) {
            if (!meetings.some((x) => x.id === m.id)) meetings.push(m);
          }
          next = b.next_page_token || "";
        } while (next);
      }

      const busy = meetings
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

      // Optional conflict test for a proposed slot
      let conflict: any = null;
      if (body?.check_start) {
        const s = new Date(body.check_start).getTime();
        const e = s + Number(body?.check_duration || 40) * 60000;
        conflict = busy.find((b3) => {
          const bs = new Date(b3.start).getTime();
          const be = new Date(b3.end).getTime();
          return s < be && e > bs;
        }) || null;
      }

      return json({ success: true, account: shared, busy, conflict, available: !conflict });
    }

    // ---------- create a demo / group meeting on the shared seat ----------
    if (action === "create_meeting") {
      const startTime = String(body?.start_time || "");
      const duration = Number(body?.duration || 40);
      if (!startTime) return json({ error: "start_time is required" }, 400);

      const resp = await fetch(`https://api.zoom.us/v2/users/${shared.zoom_user_id}/meetings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: body?.topic || "Demo class — Al Quran Time Academy",
          type: 2,
          start_time: new Date(startTime).toISOString().replace(/\.\d{3}Z$/, "Z"),
          duration,
          timezone: body?.timezone || "Asia/Karachi",
          agenda: body?.agenda || undefined,
          settings: {
            join_before_host: true,
            jbh_time: 5,
            waiting_room: false,
            auto_recording: shared.auto_record ? "cloud" : "none",
            mute_upon_entry: true,
            approval_type: 2,
          },
        }),
      });
      const created = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return json({ error: "Zoom could not create the meeting", status: resp.status, details: created }, resp.status);
      }

      // Optionally attach to a demo session record
      if (body?.demo_session_id) {
        await admin
          .from("demo_sessions")
          .update({ zoom_link: created.join_url })
          .eq("id", body.demo_session_id);
      }

      return json({
        success: true,
        meeting: {
          id: String(created.id),
          topic: created.topic,
          start_time: created.start_time,
          duration: created.duration,
          join_url: created.join_url,
          start_url: created.start_url,
          recording: shared.auto_record ? "cloud" : "off",
        },
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
