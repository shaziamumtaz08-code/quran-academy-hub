// Deletes stored recordings whose 60-day retention has elapsed.
// Removes the file from the session-recordings bucket, keeps the
// live_sessions row (metadata preserved), and marks status='expired'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "session-recordings";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: sessions, error } = await supabase
      .from("live_sessions")
      .select("id, teacher_id, recording_link")
      .eq("recording_status", "ready")
      .not("retention_expires_at", "is", null)
      .lt("retention_expires_at", new Date().toISOString())
      .limit(100);
    if (error) throw error;

    const results: any[] = [];
    for (const s of sessions || []) {
      try {
        // List all objects for this session (there may be multiple recording rows)
        const prefix = `${s.teacher_id}/${s.id}`;
        const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
        const paths = (files || []).map((f: any) => `${prefix}/${f.name}`);
        if (paths.length > 0) {
          const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
          if (delErr) throw new Error(`Storage delete failed: ${delErr.message}`);
        }

        await supabase.from("live_sessions").update({
          recording_status: "expired",
          recording_link: null,
          stored_file_size_mb: 0,
        }).eq("id", s.id);

        await supabase.from("session_recordings").update({
          status: "expired",
          play_url: null,
          download_url: null,
        }).eq("session_id", s.id);

        results.push({ sessionId: s.id, ok: true, removed: paths.length });
      } catch (err: any) {
        console.error("Expire failed for", s.id, err);
        results.push({ sessionId: s.id, error: String(err?.message || err) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Expire fatal:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
