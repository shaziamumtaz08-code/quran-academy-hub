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

const str = (v: unknown, max = 500): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const FIELDS =
  'id, full_name, email, whatsapp_number, gender, date_of_birth, address, city, country, timezone, avatar_url, registration_id, school_name, grade_level, blood_group, medical_conditions, medical_notes, emergency_contact_name, emergency_contact_phone, guardian_type, preferred_contact_method, preferred_language, first_language, arabic_level, mushaf_type, preferred_unit, father_name, father_contact, mother_name, mother_contact, learning_goals, special_needs, hear_about_us, onboarding_completed_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = str(body?.token, 128);
    const action = str(body?.action, 32);
    if (!token || !action) return json({ error: 'token and action are required' }, 400);

    const { data: profile, error } = await admin
      .from('profiles')
      .select(FIELDS)
      .eq('onboarding_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return json({ error: 'This registration link is invalid or has expired.' }, 404);

    if (action === 'load') return json({ profile });

    if (action === 'save') {
      const v = body?.values ?? {};
      const complete = body?.complete === true;

      const REQUIRED: Array<[string, string]> = [
        ['full_name', 'Student full name'],
        ['date_of_birth', 'Date of birth'],
        ['email', 'Email address'],
        ['address', 'Address'],
        ['father_name', "Father's name"],
        ['father_contact', "Father's contact number"],
        ['mother_name', "Mother's name"],
        ['mother_contact', "Mother's contact number"],
        ['emergency_contact_phone', 'Emergency contact number'],
        ['school_name', 'School / institute'],
        ['grade_level', 'Grade / class'],
      ];
      if (complete) {
        const missing = REQUIRED.filter(([k]) => !str(v[k], 400) && !(profile as Record<string, unknown>)[k]).map(([, l]) => l);
        if (missing.length) return json({ error: `Please complete: ${missing.join(', ')}` }, 400);
      }

      const update: Record<string, unknown> = {
        full_name: str(v.full_name, 120) ?? profile.full_name,
        email: str(v.email, 160),
        whatsapp_number: str(v.whatsapp_number, 40),
        father_name: str(v.father_name, 120),
        father_contact: str(v.father_contact, 40),
        mother_name: str(v.mother_name, 120),
        mother_contact: str(v.mother_contact, 40),
        gender: v.gender === 'male' || v.gender === 'female' ? v.gender : null,
        date_of_birth: str(v.date_of_birth, 20),
        address: str(v.address, 400),
        city: str(v.city, 120),
        country: str(v.country, 120),
        timezone: str(v.timezone, 80),
        school_name: str(v.school_name, 160),
        grade_level: str(v.grade_level, 60),
        blood_group: str(v.blood_group, 10),
        medical_conditions: str(v.medical_conditions, 600),
        medical_notes: str(v.medical_notes, 600),
        emergency_contact_name: str(v.emergency_contact_name, 120),
        emergency_contact_phone: str(v.emergency_contact_phone, 40),
        guardian_type: str(v.guardian_type, 60),
        preferred_contact_method: str(v.preferred_contact_method, 40),
        preferred_language: str(v.preferred_language, 60),
        arabic_level: str(v.arabic_level, 60),
        learning_goals: str(v.learning_goals, 800),
        special_needs: str(v.special_needs, 800),
        hear_about_us: str(v.hear_about_us, 200),
        updated_at: new Date().toISOString(),
      };

      for (const k of Object.keys(update)) if (update[k] === null) delete update[k];
      if (complete) update.onboarding_completed_at = new Date().toISOString();

      const { error: upErr } = await admin.from('profiles').update(update).eq('id', profile.id);
      if (upErr) throw upErr;

      if (complete) {
        await admin.from('profiles').update({ onboarding_token: null }).eq('id', profile.id);
      }

      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
