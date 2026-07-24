// Deletes Zoom cloud recordings only after we have confirmed our own
// stored copy exists in Supabase Storage. Runs on a schedule; safe to
// invoke manually. Only processes rows where recording_status='ready'
// and recording_fetched_at is at least 24h old.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "session-recordings";

async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
  if (!accountId || !clientId || !clientSecret) throw new Error("Zoom credentials missing");
  const authString = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    { method: "POST", headers: { Authorization: `Basic ${authString}` } }
  );
  if (!resp.ok) throw new Error(`Zoom token failed: ${resp.status}`);
  return (await resp.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions } = await supabase
      .from("live_sessions")
      .select("id, teacher_id, zoom_meeting_uuid, recording_fetched_at")
      .eq("recording_status", "ready")
      .is("zoom_deleted_at", null)
      .not("zoom_meeting_uuid", "is", null)
      .lt("recording_fetched_at", cutoff)
      .limit(20);

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getZoomAccessToken();
    const results: any[] = [];

    for (const s of sessions) {
      try {
        // Verify our copy actually exists in storage before deleting Zoom side
        const { data: listing, error: listErr } = await supabase.storage
          .from(BUCKET)
          .list(`${s.teacher_id}/${s.id}`);
        if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);
        if (!listing || listing.length === 0) {
          results.push({ id: s.id, skipped: "no stored file yet" });
          continue;
        }

        // Zoom double-encodes meeting UUIDs containing / or +
        const uuid = s.zoom_meeting_uuid!;
        const enc = /[\/+]/.test(uuid)
          ? encodeURIComponent(encodeURIComponent(uuid))
          : encodeURIComponent(uuid);
        const resp = await fetch(
          `https://api.zoom.us/v2/meetings/${enc}/recordings?action=trash`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok && resp.status !== 404) {
          throw new Error(`Zoom delete failed ${resp.status}: ${await resp.text()}`);
        }

        await supabase.from("live_sessions")
          .update({ zoom_deleted_at: new Date().toISOString() })
          .eq("id", s.id);
        results.push({ id: s.id, deleted: true });
      } catch (err: any) {
        console.error("Cleanup error for", s.id, err);
        results.push({ id: s.id, error: String(err?.message || err) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
