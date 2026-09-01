import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const enc = new TextEncoder();

function b64url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? enc.encode(value) : value;
  const raw = String.fromCharCode(...bytes);
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const meetingNumber = String((body as any)?.meetingNumber ?? '').replace(/\D/g, '');
    const role = Number((body as any)?.role) === 1 ? 1 : 0;
    const courseClassId = String((body as any)?.courseClassId ?? '').trim();
    const zoomAccountId = String((body as any)?.zoomAccountId ?? '').trim();

    if (!meetingNumber || meetingNumber.length < 9 || meetingNumber.length > 12) {
      return json({ error: 'Invalid meetingNumber' }, 400);
    }
    if (!courseClassId && !zoomAccountId) {
      return json({ error: 'courseClassId or zoomAccountId is required' }, 400);
    }

    // Resolve the Meeting SDK app credentials of the Zoom account that hosts
    // this class. No global fallback — the client falls back to the iframe.
    const admin = createClient(supabaseUrl, serviceKey);
    let accountId = zoomAccountId;

    if (!accountId) {
      const { data: cls, error: clsErr } = await admin
        .from('course_classes')
        .select('id, zoom_account_id')
        .eq('id', courseClassId)
        .maybeSingle();
      if (clsErr) return json({ error: clsErr.message }, 500);
      if (!cls?.zoom_account_id) {
        return json({ error: 'This class has no linked Zoom account' }, 404);
      }
      accountId = cls.zoom_account_id;
    }

    const { data: acct, error: acctErr } = await admin
      .from('zoom_accounts')
      .select('id, zoom_meeting_sdk_client_id, zoom_meeting_sdk_client_secret')
      .eq('id', accountId)
      .maybeSingle();
    if (acctErr) return json({ error: acctErr.message }, 500);

    // Credentials are pasted from Zoom. Normalize harmless surrounding
    // whitespace here so a copied newline cannot produce an invalid JWT.
    const clientId = String(acct?.zoom_meeting_sdk_client_id ?? '').trim();
    const clientSecret = String(acct?.zoom_meeting_sdk_client_secret ?? '').trim();
    if (!clientId || !clientSecret) {
      return json({ error: 'Meeting SDK credentials are not configured for this Zoom account' }, 404);
    }


    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours max

    const signature = await signJwt(
      {
        appKey: clientId,
        // Zoom's current Meeting SDK validator expects the mn claim to be a
        // number, matching its official signature endpoint sample.
        mn: Number(meetingNumber),
        role,
        iat,
        exp,
        tokenExp: exp,
      },
      clientSecret,
    );

    return json({ signature });
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500);
  }
});
