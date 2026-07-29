// Receives Zoom's recording.completed webhook and attaches the recording URL
// to the matching shared-pool booking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    const payload = JSON.parse(raw || "{}");
    const secret = Deno.env.get("ZOOM_WEBHOOK_SECRET_TOKEN") ?? "";

    // Zoom URL validation handshake
    if (payload.event === "endpoint.url_validation" && secret) {
      const plainToken = payload?.payload?.plainToken ?? "";
      return json({ plainToken, encryptedToken: await hmacHex(secret, plainToken) });
    }

    // Signature verification (when the secret is configured)
    if (secret) {
      const ts = req.headers.get("x-zm-request-timestamp") ?? "";
      const signature = req.headers.get("x-zm-signature") ?? "";
      const expected = `v0=${await hmacHex(secret, `v0:${ts}:${raw}`)}`;
      if (signature !== expected) return json({ error: "Invalid signature" }, 401);
    }

    if (payload.event !== "recording.completed") {
      return json({ ignored: true, event: payload.event });
    }

    const obj = payload?.payload?.object ?? {};
    const meetingId = String(obj.id ?? "");
    const pmi = String(obj.pmi ?? "").replace(/\D/g, "");
    const startTime = obj.start_time ? new Date(obj.start_time) : new Date();
    const duration = Number(obj.duration ?? 60);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const files = Array.isArray(obj.recording_files) ? obj.recording_files : [];
    const recordingUrl =
      obj.share_url ||
      files.find((f: any) => f.file_type === "MP4")?.play_url ||
      files.find((f: any) => f.play_url)?.play_url ||
      null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Match by meeting id / PMI plus an overlapping time window (±2h tolerance)
    const windowStart = new Date(startTime.getTime() - 2 * 3600000).toISOString();
    const windowEnd = new Date(endTime.getTime() + 2 * 3600000).toISOString();

    const ids = [meetingId, pmi].filter(Boolean);
    const { data: candidates, error } = await admin
      .from("zoom_pool_bookings")
      .select("id, zoom_meeting_id, start_time, vault_account_id")
      .in("zoom_meeting_id", ids.length ? ids : ["__none__"])
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .order("start_time", { ascending: true });

    if (error) return json({ error: error.message }, 500);
    if (!candidates?.length) return json({ matched: false, meeting_id: meetingId });

    // Closest booking to the actual meeting start
    const best = candidates.reduce((a: any, b: any) =>
      Math.abs(new Date(a.start_time).getTime() - startTime.getTime()) <=
      Math.abs(new Date(b.start_time).getTime() - startTime.getTime()) ? a : b
    );

    const { error: upErr } = await admin
      .from("zoom_pool_bookings")
      .update({ recording_url: recordingUrl, status: "completed" })
      .eq("id", best.id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ matched: true, booking_id: best.id, recording_url: recordingUrl });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
