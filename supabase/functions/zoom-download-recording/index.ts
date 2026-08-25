// Downloads Zoom cloud recordings and stores them in Supabase Storage
// (session-recordings bucket). Retries up to 3 times, never deletes the
// Zoom-side copy — that is done by zoom-cleanup-recordings after a safety
// window.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "session-recordings";
const MAX_ATTEMPTS = 3;

async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured (ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET)");
  }
  const authString = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    { method: "POST", headers: { Authorization: `Basic ${authString}` } }
  );
  if (!resp.ok) throw new Error(`Zoom token failed: ${resp.status} ${await resp.text()}`);
  const j = await resp.json();
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth gate: internal cron/service callers use the service key (worker secret or
  // bearer token); human callers must be admin/super_admin staff.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const internal =
    req.headers.get("x-worker-secret") === serviceKey || bearer === serviceKey;
  if (!internal) {
    const auth = await requireRole(req, ["admin", "super_admin"]);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { session_id: bodySessionId } = await req.json().catch(() => ({}));


    // Batch mode: if no session_id, pick pending sessions (up to 5)
    let sessionIds: string[] = [];
    if (bodySessionId) {
      sessionIds = [bodySessionId];
    } else {
      const { data } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("recording_status", "pending")
        .lt("download_attempts", MAX_ATTEMPTS)
        .order("actual_end", { ascending: false })
        .limit(5);
      sessionIds = (data || []).map((r: any) => r.id);
    }

    const results: any[] = [];
    let accessToken: string | null = null;

    for (const sessionId of sessionIds) {
      try {
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, teacher_id, download_attempts")
          .eq("id", sessionId)
          .maybeSingle();
        if (!session) { results.push({ sessionId, skipped: "no session" }); continue; }

        const { data: recs } = await supabase
          .from("session_recordings")
          .select("id, download_url, play_url, file_type, recording_type")
          .eq("session_id", sessionId)
          .eq("status", "pending");

        const mp4 = (recs || []).find((r: any) => (r.file_type || "").toUpperCase() === "MP4");
        const rec = mp4 || (recs || [])[0];
        if (!rec) { results.push({ sessionId, skipped: "no pending recording rows" }); continue; }

        if (!accessToken) accessToken = await getZoomAccessToken();
        const dlUrl = rec.download_url || rec.play_url;
        if (!dlUrl) throw new Error("Recording row missing download_url");

        const dl = await fetch(`${dlUrl}?access_token=${accessToken}`);
        if (!dl.ok || !dl.body) {
          throw new Error(`Zoom download HTTP ${dl.status}: ${await dl.text().catch(() => "")}`);
        }

        const originalBuf = new Uint8Array(await dl.arrayBuffer());
        const originalSizeMb = Math.round((originalBuf.byteLength / 1048576) * 100) / 100;
        const ext = (rec.file_type || "MP4").toLowerCase();

        // COMPRESSION: Deno edge runtime cannot execute native ffmpeg and
        // ffmpeg.wasm is not viable for multi-hundred-MB class recordings
        // (memory + 150s CPU cap). We record compression_status so admins
        // can see the file went through the pipeline; heavy re-encoding is
        // handled downstream by an external worker if/when configured.
        // If future infra allows in-line compression, swap `finalBuf` here.
        let finalBuf = originalBuf;
        let compressionStatus: "skipped_runtime" | "compressed" | "failed_fallback_original" = "skipped_runtime";
        // (Placeholder for future ffmpeg step — keep fallback semantics intact.)
        const finalSizeMb = Math.round((finalBuf.byteLength / 1048576) * 100) / 100;

        const path = `${session.teacher_id}/${sessionId}/${rec.recording_type || "recording"}-${rec.id}.${ext}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, finalBuf, {
          contentType: ext === "mp4" ? "video/mp4" : "application/octet-stream",
          upsert: true,
        });
        if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

        const storageUrl = `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}`;

        await supabase.from("session_recordings").update({
          status: "available",
          play_url: storageUrl,
          download_url: storageUrl,
          file_size_mb: finalSizeMb,
        }).eq("id", rec.id);

        const fetchedAt = new Date();
        const retentionAt = new Date(fetchedAt.getTime() + 60 * 24 * 60 * 60 * 1000);
        await supabase.from("live_sessions").update({
          recording_status: "ready",
          recording_link: storageUrl,
          recording_fetched_at: fetchedAt.toISOString(),
          retention_expires_at: retentionAt.toISOString(),
          stored_file_size_mb: finalSizeMb,
          original_file_size_mb: originalSizeMb,
          compression_status: compressionStatus,
          download_last_error: null,
        }).eq("id", sessionId);

        results.push({ sessionId, ok: true, sizeMb: finalSizeMb, originalSizeMb, compressionStatus });
      } catch (err: any) {
        console.error("Download failed for", sessionId, err);
        const msg = String(err?.message || err);
        const { data: cur } = await supabase
          .from("live_sessions")
          .select("download_attempts")
          .eq("id", sessionId)
          .maybeSingle();
        const attempts = (cur?.download_attempts || 0) + 1;
        await supabase.from("live_sessions").update({
          download_attempts: attempts,
          download_last_error: msg,
          recording_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        }).eq("id", sessionId);
        if (attempts >= MAX_ATTEMPTS) {
          await supabase.from("session_recordings")
            .update({ status: "failed" })
            .eq("session_id", sessionId)
            .eq("status", "pending");
        }
        results.push({ sessionId, error: msg, attempts });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Downloader fatal:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
