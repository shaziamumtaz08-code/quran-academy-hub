import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const str = (v: unknown, max = 500): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const maskTail = (v: string | null) => (v ? `••••${v.slice(-4)}` : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = str(body?.token, 128);
    const action = str(body?.action, 32);
    if (!token || !action) return json({ error: 'token and action are required' }, 400);

    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, full_name, email, whatsapp_number, gender, date_of_birth, address, avatar_url, registration_id, department, designation, qualification, specialization, years_experience, joining_date, employment_type, cv_url, cv_file_name, cv_uploaded_at, cv_status, banking_status, zoom_personal_id, zoom_email, onboarding_completed_at',
      )
      .eq('onboarding_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return json({ error: 'This onboarding link is invalid or has expired.' }, 404);

    const { data: sensitive } = await admin
      .from('profile_sensitive_data')
      .select('bank_name, bank_account_title, bank_account_number, bank_iban')
      .eq('user_id', profile.id)
      .maybeSingle();

    const banking = {
      bank_name: sensitive?.bank_name ?? null,
      bank_account_title: sensitive?.bank_account_title ?? null,
      bank_account_number_masked: maskTail(sensitive?.bank_account_number ?? null),
      bank_iban_masked: maskTail(sensitive?.bank_iban ?? null),
      has_account_number: !!sensitive?.bank_account_number,
      has_iban: !!sensitive?.bank_iban,
    };

    if (action === 'load') return json({ profile, banking });

    if (action === 'save') {
      const step = str(body?.step, 32);
      const values = body?.values ?? {};

      if (step === 'personal') {
        await admin
          .from('profiles')
          .update({
            full_name: str(values.full_name, 120) ?? profile.full_name,
            whatsapp_number: str(values.whatsapp_number, 40),
            gender: values.gender === 'male' || values.gender === 'female' ? values.gender : null,
            date_of_birth: str(values.date_of_birth, 20),
            address: str(values.address, 400),
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      } else if (step === 'banking') {
        const payload = {
          user_id: profile.id,
          bank_name: str(values.bank_name, 120),
          bank_account_title: str(values.bank_account_title, 120),
          bank_account_number:
            str(values.bank_account_number, 60) ?? sensitive?.bank_account_number ?? null,
          bank_iban: str(values.bank_iban, 60) ?? sensitive?.bank_iban ?? null,
          updated_at: new Date().toISOString(),
        };
        await admin.from('profile_sensitive_data').upsert(payload, { onConflict: 'user_id' });
        await admin
          .from('profiles')
          .update({
            bank_name: payload.bank_name,
            bank_account_title: payload.bank_account_title,
            bank_account_number: payload.bank_account_number,
            bank_iban: payload.bank_iban,
            banking_status: 'pending',
          })
          .eq('id', profile.id);
      } else if (step === 'communication') {
        await admin
          .from('profiles')
          .update({
            zoom_personal_id: str(values.zoom_personal_id, 60),
            zoom_email: str(values.zoom_email, 160),
            whatsapp_number: str(values.whatsapp_number, 40) ?? profile.whatsapp_number,
          })
          .eq('id', profile.id);
      } else {
        return json({ error: 'Unknown step' }, 400);
      }

      return json({ ok: true });
    }

    if (action === 'upload_cv') {
      const fileName = str(body?.file_name, 200);
      const contentType = str(body?.content_type, 120) ?? 'application/octet-stream';
      const base64 = typeof body?.file_base64 === 'string' ? body.file_base64 : null;
      if (!fileName || !base64) return json({ error: 'file_name and file_base64 required' }, 400);

      const ext = (fileName.split('.').pop() ?? '').toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext)) return json({ error: 'Only PDF or DOC files allowed' }, 400);

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (bytes.length > 5 * 1024 * 1024) return json({ error: 'File exceeds the 5MB limit' }, 400);

      const path = `${profile.id}/cv-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from('teacher-documents')
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) throw upErr;

      await admin
        .from('profiles')
        .update({
          cv_url: path,
          cv_file_name: fileName,
          cv_uploaded_at: new Date().toISOString(),
          cv_status: 'pending',
        })
        .eq('id', profile.id);

      const { data: admins } = await admin
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin']);
      if (admins?.length) {
        await admin.from('notification_queue').insert(
          admins.map((a: { user_id: string }) => ({
            recipient_id: a.user_id,
            recipient_type: 'admin',
            notification_type: 'teacher_cv_pending',
            title: 'CV pending review',
            message: `${profile.full_name ?? 'A teacher'} uploaded a new CV for review.`,
            metadata: { teacher_id: profile.id },
          })),
        );
      }

      return json({ ok: true, cv_file_name: fileName });
    }

    if (action === 'complete') {
      await admin
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', profile.id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('teacher-onboarding error', e);
    return json({ error: (e as Error).message ?? 'Unexpected error' }, 500);
  }
});
