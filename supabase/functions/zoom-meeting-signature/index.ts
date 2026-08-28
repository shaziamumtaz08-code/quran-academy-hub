import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Meeting SDK apps have their OWN Client ID/Secret — separate from the S2S OAuth app.
    const clientId = Deno.env.get('ZOOM_MEETING_SDK_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_MEETING_SDK_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json({ error: 'Zoom Meeting SDK credentials are not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const meetingNumber = String(body?.meetingNumber ?? '').replace(/\D/g, '');
    const role = Number(body?.role) === 1 ? 1 : 0;
    if (!meetingNumber || meetingNumber.length < 9 || meetingNumber.length > 12) {
      return json({ error: 'Invalid meetingNumber' }, 400);
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours max

    const signature = await signJwt(
      {
        appKey: clientId,
        sdkKey: clientId,
        mn: meetingNumber,
        role,
        iat,
        exp,
        tokenExp: exp,
      },
      clientSecret,
    );

    return json({ signature, sdkKey: clientId });
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500);
  }
});
