// Validates a single Zoom account's S2S OAuth setup end-to-end and, when
// teacher_id + tier are provided, saves the validated account to zoom_accounts
// as the teacher's dedicated Zoom account (replacing shared-pool assignment).
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
  teacher_id?: string;
  tier?: "free" | "licensed";
  save?: boolean;
  personal_meeting_link?: string;
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
    const { account_id, client_id, client_secret, zoom_email, teacher_id, tier, save, personal_meeting_link } = body;
    if (!account_id || !client_id || !client_secret || !zoom_email) {
      return json({
        step: "input",
        error: "account_id, client_id, client_secret, and zoom_email are all required",
      }, 400);
    }

    const checks: Array<{ step: string; ok: boolean; detail?: string; data?: any }> = [];

    // Persist the credentials the admin typed even when Zoom rejects them, so
    // nothing is lost and the seat is visibly marked as failed (never silently
    // "saved but unverified"). Only ever touches the seat being saved.
    const saveFailedCredentials = async (reason: string) => {
      if (!(save && teacher_id)) return null;
      const { data: existing } = await adminClient
        .from("zoom_accounts")
        .select("id")
        .eq("teacher_id", teacher_id)
        .eq("tier", tier || "free")
        .maybeSingle();
      const payload: Record<string, unknown> = {
        teacher_id,
        tier: tier || "free",
        zoom_account_email: zoom_email,
        zoom_account_id_cred: account_id,
        zoom_client_id: client_id,
        zoom_client_secret: client_secret,
        credential_status: "failed",
        credential_error: reason.slice(0, 1000),
        credential_checked_at: new Date().toISOString(),
      };
      if (personal_meeting_link) payload.meeting_link = personal_meeting_link;
      const { data, error } = existing
        ? await adminClient.from("zoom_accounts").update(payload).eq("id", existing.id).select("id").maybeSingle()
        : await adminClient.from("zoom_accounts").insert({ ...payload, is_active: true }).select("id").maybeSingle();
      if (error) {
        checks.push({ step: "save_account", ok: false, detail: `Credentials could not be stored: ${error.message}` });
        return null;
      }
      checks.push({ step: "save_account", ok: true, detail: "Credentials stored and flagged as FAILED — retry after fixing the Zoom app." });
      return data;
    };

    // STEP 1: Mint S2S OAuth token
    const authString = btoa(`${client_id}:${client_secret}`);
    const tokenResp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account_id}`,
      { method: "POST", headers: { Authorization: `Basic ${authString}` } }
    );
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      const reason = `Zoom rejected credentials (HTTP ${tokenResp.status}): ${tokenData.reason || tokenData.message || JSON.stringify(tokenData).slice(0, 300)}`;
      checks.push({ step: "oauth_token", ok: false, detail: reason });
      const stored = await saveFailedCredentials(reason);
      return json({
        ok: false,
        checks,
        credential_status: "failed",
        failure_reason: reason,
        stored_unverified: Boolean(stored),
        verdict: "Fix: verify Account ID / Client ID / Client Secret in the Marketplace S2S app.",
      });
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
      const hasUserScope = scopes.some((s: string) =>
        s.startsWith("user:read:user") || s === "user:read" || s === "user:read:admin"
      );
      const scopeHint = hasUserScope
        ? "Email may not exist on this Zoom account."
        : "Missing user read scope — add 'user:read:user:admin' (Granular) or 'user:read:admin' (Classic) to the S2S app and reactivate.";
      const reason = `Host lookup failed (HTTP ${userResp.status}): ${userBody.message || JSON.stringify(userBody).slice(0, 300)} — ${scopeHint}`;
      checks.push({ step: "user_lookup", ok: false, detail: reason });
      const stored = await saveFailedCredentials(reason);
      return json({
        ok: false,
        checks,
        credential_status: "failed",
        failure_reason: reason,
        stored_unverified: Boolean(stored),
        verdict: `Fix: ${scopeHint}`,
      });
    }
    const hostId = userBody.id;
    const planType = userBody.type; // 1=Basic (free), 2=Licensed, 3=On-prem
    const planLabel = planType === 1 ? "Basic (free)" : planType === 2 ? "Licensed (paid)" : `Type ${planType}`;
    const resolvedTier: "free" | "licensed" = planType === 2 ? "licensed" : "free";
    const personalMeetingUrl = userBody.personal_meeting_url || null;
    checks.push({
      step: "user_lookup",
      ok: true,
      detail: `host_id=${hostId} plan=${planLabel} tz=${userBody.timezone || "?"}`,
      data: { host_id: hostId, plan_type: planType, plan_label: planLabel, timezone: userBody.timezone, first_name: userBody.first_name, last_name: userBody.last_name, personal_meeting_url: personalMeetingUrl },
    });

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || "";
    const webhookUrl = `${supabaseUrl}/functions/v1/zoom-webhook`;
    checks.push({
      step: "webhook_setup",
      ok: true,
      detail: "Manual step: paste this URL as the Event Notification Endpoint in your Marketplace app and subscribe to meeting.started/ended, participant_joined/left, recording.completed. Then click 'Send test event' in Zoom.",
      data: { webhook_url: webhookUrl, project_ref: projectRef },
    });

    // STEP 4 (optional): Save as a teacher's dedicated zoom account
    let saved: any = null;
    if (save && teacher_id) {
      const finalTier: "free" | "licensed" = tier || resolvedTier;
      const meetingLink = personal_meeting_link || personalMeetingUrl;
      const nowIso = new Date().toISOString();
      const upsertPayload = {
        teacher_id,
        zoom_account_email: zoom_email,
        zoom_user_id: hostId,
        tier: finalTier,
        meeting_link: meetingLink,
        is_active: true,
        last_validated_at: nowIso,
        zoom_account_id_cred: account_id,
        zoom_client_id: client_id,
        zoom_client_secret: client_secret,
        credential_status: "verified",
        credential_error: null,
        credential_checked_at: nowIso,
      };
      const { data: upserted, error: upErr } = await adminClient
        .from("zoom_accounts")
        .upsert(upsertPayload, { onConflict: "teacher_id,tier" })
        .select("id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active, last_validated_at, credential_status")
        .maybeSingle();
      if (upErr) {
        checks.push({ step: "save_account", ok: false, detail: upErr.message });
      } else {
        saved = upserted;
        checks.push({ step: "save_account", ok: true, detail: `Saved as dedicated ${finalTier} account for teacher.` });
      }
    }

    return json({
      ok: true,
      credential_status: saved ? "verified" : "unverified",
      verdict: saved
        ? `PASS. ${planLabel} account saved as teacher's dedicated Zoom account.`
        : `PASS. ${planLabel} account. Ready to save as a teacher's dedicated Zoom account.`,
      checks,
      saved,
      resolved: {
        host_id: hostId,
        plan_label: planLabel,
        plan_type: planType,
        resolved_tier: resolvedTier,
        personal_meeting_url: personalMeetingUrl,
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
