CREATE TABLE IF NOT EXISTS public.family_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name text NOT NULL,
  relationship text,
  email text NOT NULL,
  phone text NOT NULL,
  country text,
  city text,
  timezone text,
  address text,
  occupation text,
  preferred_contact text,
  notes text,
  children jsonb NOT NULL DEFAULT '[]'::jsonb,
  registration_type text NOT NULL DEFAULT 'parent',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_profile_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.family_registrations TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.family_registrations TO authenticated;
GRANT ALL ON public.family_registrations TO service_role;

ALTER TABLE public.family_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a family registration"
  ON public.family_registrations FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins view family registrations"
  ON public.family_registrations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update family registrations"
  ON public.family_registrations FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete family registrations"
  ON public.family_registrations FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_family_registrations_updated_at
  BEFORE UPDATE ON public.family_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_family_registrations_status ON public.family_registrations (status, created_at DESC);

-- Pre-fill helper: requires BOTH email and phone to match so enquiries cannot be enumerated
CREATE OR REPLACE FUNCTION public.lookup_family_prefill(_email text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_phone text := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  norm_email text := lower(trim(coalesce(_email, '')));
  result jsonb;
BEGIN
  IF norm_email = '' OR length(norm_phone) < 7 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'lead_id', (array_agg(l.id ORDER BY l.created_at DESC))[1],
    'parent_name', (array_agg(coalesce(l.guardian_name, l.name) ORDER BY l.created_at DESC))[1],
    'relationship', (array_agg(l.guardian_relationship ORDER BY l.created_at DESC))[1],
    'country', (array_agg(l.country ORDER BY l.created_at DESC))[1],
    'city', (array_agg(l.city ORDER BY l.created_at DESC))[1],
    'timezone', (array_agg(l.timezone ORDER BY l.created_at DESC))[1],
    'children', coalesce(jsonb_agg(DISTINCT jsonb_build_object(
        'name', coalesce(l.child_name, l.name),
        'age', l.child_age,
        'gender', coalesce(l.child_gender, l.gender),
        'subjects', l.subject_interest,
        'preferred_time', l.preferred_time
      )) FILTER (WHERE coalesce(l.child_name, l.name) IS NOT NULL), '[]'::jsonb)
  )
  INTO result
  FROM public.leads l
  WHERE lower(trim(l.email)) = norm_email
    AND regexp_replace(coalesce(l.phone_whatsapp, ''), '[^0-9]', '', 'g') LIKE '%' || right(norm_phone, 9);

  RETURN coalesce(result, jsonb_build_object('found', false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_family_prefill(text, text) TO anon, authenticated;

-- Keep private organization settings out of reach for ordinary users
REVOKE SELECT ON public.organizations FROM authenticated, anon;
GRANT SELECT (id, name, slug, logo_url, code, created_at, updated_at) ON public.organizations TO authenticated;