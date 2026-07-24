// Validates a single Zoom account's S2S OAuth setup end-to-end BEFORE
// adding it to the license pool. Used as "step zero" per the 10-account
// rollout plan — surfaces token minting, account tier, host_id lookup,
// and the exact webhook URL the admin must paste into the Marketplace app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  account_id: string;
  client_id: string;
  client_secret: string;
  zoom_email: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Admin gate — super_admin OR admin OR admin_division
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) =>
      ["super_admin", "admin"].includes(r.role) || String(r.role).startsWith("admin_")
    );
    if (!allowed) return json({ error: "Admin access required" }, 403);

    const body: Body = await req.json().catch(() => ({} as Body));
    const { account_id, client_id, client_secret, zoom_email } = body;
    if (!account_id || !client_id || !client_secret || !zoom_email) {
      return json({
        step: "input",
        error: "account_id, client_id, client_secret, and zoom_email are all required",
      }, 400);
    }

    const checks: Array<{ step: string; ok: boolean; detail?: string; data?: any }> = [];

    // STEP 1: Mint S2S OAuth token
    const authString = btoa(`${client_id}:${client_secret}`);
    const tokenResp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account_id}`,
      { method: "POST", headers: { Authorization: `Basic ${authString}` } }
    );
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      checks.push({
        step: "oauth_token",
        ok: false,
        detail: `Zoom rejected credentials (HTTP ${tokenResp.status}): ${tokenData.reason || tokenData.message || JSON.stringify(tokenData).slice(0, 300)}`,
      });
      return json({ ok: false, checks, verdict: "Fix: verify Account ID / Client ID / Client Secret in the Marketplace S2S app." });
    }
    const scopes = String(tokenData.scope || "").split(/\s+/).filter(Boolean);
    checks.push({ step: "oauth_token", ok: true, detail: `Token minted, scopes=${scopes.length}`, data: { scopes } });

    // STEP 2: Look up host user by email
    const userResp = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(zoom_email)}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userBody = await userResp.json();
    if (!userResp.ok) {
      checks.push({
        step: "user_lookup",
        ok: false,
        detail: `HTTP ${userResp.status}: ${userBody.message || JSON.stringify(userBody).slice(0, 300)}`,
      });
      const hasUserScope = scopes.some((s: string) =>
        s.startsWith("user:read:user") || s === "user:read" || s === "user:read:admin"
      );
      const scopeHint = hasUserScope
        ? "Email may not exist on this account."
        : "Missing user read scope — add 'user:read:user:admin' (Granular) or 'user:read:admin' (Classic) to the S2S app and reactivate.";
      return json({ ok: false, checks, verdict: `Fix: ${scopeHint}` });
    }
    const hostId = userBody.id;
    const planType = userBody.type; // 1=Basic (free), 2=Licensed, 3=On-prem
    const planLabel = planType === 1 ? "Basic (free)" : planType === 2 ? "Licensed (paid)" : `Type ${planType}`;
    checks.push({
      step: "user_lookup",
      ok: true,
      detail: `host_id=${hostId} plan=${planLabel} tz=${userBody.timezone || "?"}`,
      data: { host_id: hostId, plan_type: planType, plan_label: planLabel, timezone: userBody.timezone, first_name: userBody.first_name, last_name: userBody.last_name },
    });

    // STEP 3: Check webhook subscription capability (best-effort — S2S app inspection isn't exposed via API,
    // so we surface the webhook URL the admin must configure and let them send a test event).
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || "";
    const webhookUrl = `${supabaseUrl}/functions/v1/zoom-webhook`;
    checks.push({
      step: "webhook_setup",
      ok: true,
      detail: "Manual step: paste this URL as the Event Notification Endpoint in your Marketplace app and subscribe to meeting.participant_joined / meeting.participant_left / meeting.ended events. Then click 'Send test event' in Zoom.",
      data: { webhook_url: webhookUrl, project_ref: projectRef },
    });

    return json({
      ok: true,
      verdict: `PASS. ${planLabel} account. Ready to add to license pool once you confirm the webhook test event arrives (check Join Logs tab).`,
      checks,
      resolved: {
        host_id: hostId,
        plan_label: planLabel,
        webhook_url: webhookUrl,
      },
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
