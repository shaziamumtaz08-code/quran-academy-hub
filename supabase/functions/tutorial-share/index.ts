import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Public, token-scoped access to a Help Centre walkthrough video.
 * GET ?token=<share_token>            -> guide metadata + signed video/poster URLs
 * GET ?token=<share_token>&mode=video -> 302 redirect straight to the video (for raw links)
 * Nothing is exposed unless the guide has share_enabled = true and a rendered video.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get('token') || '').trim();
    const mode = url.searchParams.get('mode') || 'meta';

    if (!/^[a-f0-9]{16,64}$/i.test(token)) {
      return json({ error: 'Invalid share link.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin.rpc('get_shared_walkthrough', { _token: token });
    if (error) {
      console.error('get_shared_walkthrough failed:', error.message);
      return json({ error: 'Could not load this walkthrough.' }, 500);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return json({ error: 'This walkthrough link is not available.' }, 404);

    const { data: signed, error: signErr } = await admin.storage
      .from('tutorial-videos')
      .createSignedUrl(row.video_path, 60 * 60 * 6);
    if (signErr || !signed?.signedUrl) {
      console.error('sign video failed:', signErr?.message);
      return json({ error: 'Video is temporarily unavailable.' }, 500);
    }

    if (mode === 'video') {
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl } });
    }

    let posterUrl: string | null = null;
    if (row.poster_path) {
      const { data: p } = await admin.storage
        .from('tutorial-videos')
        .createSignedUrl(row.poster_path, 60 * 60 * 6);
      posterUrl = p?.signedUrl ?? null;
    }

    return json({
      title: row.title,
      category: row.category,
      description: row.description,
      duration_seconds: row.duration_seconds,
      steps: Array.isArray(row.walkthrough_frames)
        ? row.walkthrough_frames.map((f: { step: number; label: string }) => ({ step: f.step, label: f.label }))
        : [],
      video_url: signed.signedUrl,
      poster_url: posterUrl,
    });
  } catch (e) {
    console.error('tutorial-share error:', e);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
