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

// ── Matching helpers ────────────────────────────────────────────────
const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const normPhone = (v: unknown) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
};
const normName = (v: unknown) =>
  String(v ?? '').toLowerCase().replace(/[^a-z\u0600-\u06FF]/g, '');
// Vowel-squashed skeleton: "arham" and "arhm" collapse to the same key.
const nameKey = (v: unknown) => normName(v).replace(/[aeiou]/g, '');

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function nameSimilar(a: string, b: string) {
  const x = normName(a), y = normName(b);
  if (!x || !y || x.length < 3 || y.length < 3) return false;
  if (x === y) return true;
  const kx = nameKey(a), ky = nameKey(b);
  if (kx && kx === ky) return true;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length) >= 0.82;
}

type Candidate = {
  id: string;
  name: string | null;
  child_name: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  status: string | null;
  enrollment_form_token: string | null;
  enrollment_form_data: unknown;
};

/**
 * Duplicate detection: email OR phone OR fuzzy name.
 * Strong signals (email/phone) prove ownership, so the submitter may reopen and
 * edit their earlier form. A name-only match is blocked for academy review.
 */
async function findDuplicate(values: Record<string, unknown>, excludeId?: string) {
  const email = normEmail(values.student_email) || normEmail(values.parent_email);
  const altEmail = normEmail(values.parent_email);
  const phone = normPhone(values.student_whatsapp) || normPhone(values.parent_whatsapp);
  const altPhone = normPhone(values.parent_whatsapp);
  const name = String(values.student_name ?? '');

  const { data } = await admin
    .from('leads')
    .select('id, name, child_name, email, phone_whatsapp, status, enrollment_form_token, enrollment_form_data')
    .limit(2000);

  const rows = ((data as Candidate[]) ?? []).filter((r) => r.id !== excludeId);
  const emails = [email, altEmail].filter(Boolean);
  const phones = [phone, altPhone].filter(Boolean);

  for (const r of rows) {
    const rEmail = normEmail(r.email);
    const rPhone = normPhone(r.phone_whatsapp);
    if (rEmail && emails.includes(rEmail)) return { row: r, reason: 'email' as const, strong: true };
    if (rPhone && phones.includes(rPhone)) return { row: r, reason: 'phone' as const, strong: true };
  }
  for (const r of rows) {
    if (nameSimilar(name, r.name || '') || nameSimilar(name, r.child_name || '')) {
      return { row: r, reason: 'name' as const, strong: false };
    }
  }
  return null;
}

function duplicateResponse(match: { row: Candidate; reason: string; strong: boolean }) {
  return json({
    error: 'duplicate',
    duplicate: {
      reason: match.reason,
      matched_name: match.row.child_name || match.row.name,
      has_submission: Boolean(match.row.enrollment_form_data),
      // Ownership proven by matching email/phone → let them edit their own form.
      edit_token: match.strong ? match.row.enrollment_form_token : null,
    },
    message: match.strong
      ? 'We already have a form for these contact details. You can open and update it instead of submitting a new one.'
      : 'A record with a very similar name already exists. Please contact the academy so we can update the existing application.',
  }, 409);
}

function stripSecrets(values: Record<string, unknown>) {
  const v = { ...values };
  delete v.password;
  delete v.confirm_password;
  return v;
}

// Keep every earlier version of the form for auditability.
function withRevision(previous: unknown, next: Record<string, unknown>) {
  const prev = (previous ?? null) as Record<string, unknown> | null;
  const history = Array.isArray(prev?._revisions) ? (prev!._revisions as unknown[]) : [];
  if (prev) {
    const snapshot = { ...prev };
    delete snapshot._revisions;
    history.push({ saved_at: new Date().toISOString(), values: snapshot });
  }
  return { ...next, _revisions: history.slice(-10) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!action) return json({ error: 'action is required' }, 400);

    // ── Open (no lead) submission ──
    if (action === 'open-submit') {
      const values = stripSecrets({ ...(body?.values ?? {}) } as Record<string, unknown>);
      const name = String(values.student_name ?? '').trim();
      if (name.length < 2) return json({ error: 'Student name is required.' }, 400);
      if (!normEmail(values.student_email) && !normEmail(values.parent_email) &&
          !normPhone(values.student_whatsapp) && !normPhone(values.parent_whatsapp)) {
        return json({ error: 'Please provide an email address or WhatsApp number.' }, 400);
      }

      // Only block on proven identity matches (email/phone). A merely similar
      // name is common (e.g. "Muhammad Ali") and must not reject a genuine student.
      const match = await findDuplicate(values);
      if (match?.strong) return duplicateResponse(match);

      const isChild = Boolean(values.parent_name) && Boolean(values.parent_email || values.parent_whatsapp);
      const { data: created, error: insErr } = await admin
        .from('leads')
        .insert({
          name: isChild ? String(values.parent_name) : name,
          email: normEmail(values.student_email) || normEmail(values.parent_email) || null,
          phone_whatsapp: String(values.student_whatsapp || values.parent_whatsapp || '') || null,
          country: values.student_country || null,
          city: values.student_city || null,
          for_whom: isChild ? 'child' : 'self',
          child_name: isChild ? name : null,
          child_gender: (values.student_gender as string) || null,
          guardian_name: isChild ? String(values.parent_name) : null,
          guardian_relationship: (values.parent_relationship as string) || null,
          status: 'form_submitted',
          enrollment_form_token: crypto.randomUUID(),
          enrollment_form_data: withRevision(null, values),
        })
        .select('id, enrollment_form_token')
        .single();

      if (insErr) throw insErr;
      return json({ ok: true, edit_token: created?.enrollment_form_token ?? null });
    }

    if (!token) return json({ error: 'token is required' }, 400);

    const { data: lead, error } = await admin
      .from('leads')
      .select(PUBLIC_FIELDS.join(', '))
      .eq('enrollment_form_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!lead) return json({ error: 'This enrollment link is invalid or has expired.' }, 404);
    const leadRow = lead as unknown as Record<string, any>;

    if (action === 'load') {
      if (!leadRow.enrollment_form_data) {
        await admin
          .from('leads')
          .update({ enrollment_form_opened_at: new Date().toISOString() })
          .eq('id', leadRow.id)
          .is('enrollment_form_opened_at', null);
      }
      return json({ lead });
    }

    if (action === 'submit') {
      const values = stripSecrets({ ...(body?.values ?? {}) } as Record<string, unknown>);
      // Re-submitting the same link is an EDIT of that record, never a new one.
      // Name-only matches never block an invited student; only same email/phone does.
      const match = await findDuplicate(values, leadRow.id);
      if (match?.strong) return duplicateResponse(match);

      const payload = withRevision(leadRow.enrollment_form_data, values);
      const { error: upErr } = await admin
        .from('leads')
        .update({ enrollment_form_data: payload, status: 'form_submitted' })
        .eq('id', leadRow.id);
      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
