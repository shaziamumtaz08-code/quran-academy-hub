import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Only the fields the public form needs — never expose internal lead columns.
const PUBLIC_FIELDS = [
  'id', 'name', 'email', 'phone_whatsapp', 'country', 'city', 'for_whom',
  'child_name', 'child_age', 'child_gender', 'subject_interest',
  'guardian_name', 'guardian_relationship', 'enrollment_form_data', 'status',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!token || !action) return json({ error: 'token and action are required' }, 400);

    const { data: lead, error } = await admin
      .from('leads')
      .select(PUBLIC_FIELDS.join(', '))
      .eq('enrollment_form_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!lead) return json({ error: 'This enrollment link is invalid or has expired.' }, 404);

    if (action === 'load') {
      if (!(lead as Record<string, unknown>).enrollment_form_data) {
        await admin
          .from('leads')
          .update({ enrollment_form_opened_at: new Date().toISOString() })
          .eq('id', (lead as Record<string, string>).id)
          .is('enrollment_form_opened_at', null);
      }
      return json({ lead });
    }

    if (action === 'submit') {
      if ((lead as Record<string, unknown>).enrollment_form_data) {
        return json({ error: 'This form has already been submitted.' }, 409);
      }
      const values = { ...(body?.values ?? {}) } as Record<string, unknown>;
      // Never persist raw passwords in the lead record.
      delete values.password;
      delete values.confirm_password;

      const { error: upErr } = await admin
        .from('leads')
        .update({
          enrollment_form_data: values,
          status: 'form_submitted',
          enrollment_form_submitted_at: new Date().toISOString(),
        })
        .eq('id', (lead as Record<string, string>).id);
      // enrollment_form_submitted_at may not exist on older schemas — retry without it.
      if (upErr) {
        const { error: retryErr } = await admin
          .from('leads')
          .update({ enrollment_form_data: values, status: 'form_submitted' })
          .eq('id', (lead as Record<string, string>).id);
        if (retryErr) throw retryErr;
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
