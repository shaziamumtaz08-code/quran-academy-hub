// Per-seat Zoom webhook health: reports credential/host-id/event status for
// every dedicated teacher Zoom account, and can repair missing host IDs by
// calling each account's own Server-to-Server OAuth app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  repair?: boolean;
}

type SeatStatus = "healthy" | "no_events" | "missing_host_id" | "no_credentials" | "credentials_invalid";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve caller: try the service-role admin API first (works regardless of
    // anon-key/signing-key config), then fall back to an anon client.
    let callerId: string | null = null;
    const { data: adminUser } = await admin.auth.getUser(token);
    if (adminUser?.user) callerId = adminUser.user.id;
    if (!callerId && anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser(token);
      callerId = u?.user?.id ?? null;
    }
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const allowed = (roles || []).some((r: any) =>
      ["super_admin", "admin"].includes(r.role) || String(r.role).startsWith("admin_")
    );
    if (!allowed) return json({ error: "Admin access required" }, 403);


    const body: Body = await req.json().catch(() => ({} as Body));
    const repair = body.repair === true;

    const { data: accounts, error: accErr } = await admin
      .from("zoom_accounts")
      .select(
        "id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active, last_validated_at, zoom_account_id_cred, zoom_client_id, zoom_client_secret",
      )
      .eq("is_active", true);
    if (accErr) return json({ error: accErr.message }, 500);

    const teacherIds = [...new Set((accounts || []).map((a: any) => a.teacher_id).filter(Boolean))];
    const { data: teachers } = teacherIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", teacherIds)
      : { data: [] as any[] };
    const teacherName = new Map((teachers || []).map((t: any) => [t.id, t.full_name]));

    const webhookUrl = `${supabaseUrl}/functions/v1/zoom-webhook`;
    const results: any[] = [];

    for (const acc of accounts || []) {
      const hasCreds = Boolean(acc.zoom_account_id_cred && acc.zoom_client_id && acc.zoom_client_secret);
      let hostId: string | null = acc.zoom_user_id || null;
      let repaired = false;
      let credentialError: string | null = null;
      let planLabel: string | null = null;

      if (hasCreds && (repair || !hostId)) {
        try {
          const authString = btoa(`${acc.zoom_client_id}:${acc.zoom_client_secret}`);
          const tokenResp = await fetch(
            `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${acc.zoom_account_id_cred}`,
            { method: "POST", headers: { Authorization: `Basic ${authString}` } },
          );
          const tokenData = await tokenResp.json();
          if (!tokenResp.ok || !tokenData.access_token) {
            credentialError = `OAuth failed (HTTP ${tokenResp.status}): ${tokenData.reason || tokenData.message || "unknown"}`;
          } else {
            const userResp = await fetch(
              `https://api.zoom.us/v2/users/${encodeURIComponent(acc.zoom_account_email)}`,
              { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
            );
            const userBody = await userResp.json();
            if (!userResp.ok) {
              credentialError = `User lookup failed (HTTP ${userResp.status}): ${userBody.message || "unknown"}`;
            } else {
              hostId = userBody.id;
              planLabel = userBody.type === 2 ? "Licensed (paid)" : "Basic (free)";
              const patch: Record<string, unknown> = {
                zoom_user_id: hostId,
                tier: userBody.type === 2 ? "licensed" : "free",
                last_validated_at: new Date().toISOString(),
              };
              if (!acc.meeting_link && userBody.personal_meeting_url) {
                patch.meeting_link = userBody.personal_meeting_url;
              }
              const { error: upErr } = await admin.from("zoom_accounts").update(patch).eq("id", acc.id);
              if (upErr) credentialError = `Save failed: ${upErr.message}`;
              else repaired = hostId !== acc.zoom_user_id;
            }
          }
        } catch (e) {
          credentialError = e instanceof Error ? e.message : String(e);
        }
      }

      let eventCount = 0;
      let lastEventAt: string | null = null;
      if (hostId) {
        const { count } = await admin
          .from("zoom_attendance_logs")
          .select("id", { count: "exact", head: true })
          .eq("zoom_host_id", hostId);
        eventCount = count || 0;
        const { data: lastEvent } = await admin
          .from("zoom_attendance_logs")
          .select("timestamp")
          .eq("zoom_host_id", hostId)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastEventAt = lastEvent?.timestamp || null;
      }

      let status: SeatStatus;
      if (!hasCreds) status = "no_credentials";
      else if (credentialError) status = "credentials_invalid";
      else if (!hostId) status = "missing_host_id";
      else if (eventCount === 0) status = "no_events";
      else status = "healthy";

      results.push({
        id: acc.id,
        teacher_id: acc.teacher_id,
        teacher_name: teacherName.get(acc.teacher_id) || "Unassigned",
        zoom_account_email: acc.zoom_account_email,
        tier: acc.tier,
        plan_label: planLabel,
        has_credentials: hasCreds,
        host_id: hostId,
        repaired,
        credential_error: credentialError,
        event_count: eventCount,
        last_event_at: lastEventAt,
        last_validated_at: acc.last_validated_at,
        status,
      });
    }

    results.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));

    return json({
      ok: true,
      webhook_url: webhookUrl,
      repaired_count: results.filter((r) => r.repaired).length,
      summary: {
        total: results.length,
        healthy: results.filter((r) => r.status === "healthy").length,
        no_events: results.filter((r) => r.status === "no_events").length,
        missing_host_id: results.filter((r) => r.status === "missing_host_id").length,
        no_credentials: results.filter((r) => r.status === "no_credentials").length,
        credentials_invalid: results.filter((r) => r.status === "credentials_invalid").length,
      },
      accounts: results,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
