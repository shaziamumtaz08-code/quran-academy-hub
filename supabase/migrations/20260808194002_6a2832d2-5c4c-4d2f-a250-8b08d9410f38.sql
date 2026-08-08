-- 1. Course registration type (Free / Paid / One-to-One)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_registration_type_chk'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_registration_type_chk
      CHECK (registration_type IN ('free', 'paid', 'one_to_one'));
  END IF;
END $$;

GRANT SELECT (registration_type) ON public.courses TO authenticated, anon;
GRANT UPDATE (registration_type), INSERT (registration_type) ON public.courses TO authenticated;

-- 2. Soft duplicate signals on profiles (never auto-merge; flag for human review)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid,
  ADD COLUMN IF NOT EXISTS duplicate_flag_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_reviewed_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_duplicate_pending
  ON public.profiles (duplicate_flagged_at)
  WHERE duplicate_flagged_at IS NOT NULL AND duplicate_reviewed_at IS NULL;

GRANT SELECT (possible_duplicate_of, duplicate_flag_reason, duplicate_flagged_at, duplicate_reviewed_at, duplicate_reviewed_by)
  ON public.profiles TO authenticated;

-- 3. Per-organization identity configuration (SaaS-ready: no hardcoded domain)
CREATE TABLE IF NOT EXISTS public.org_identity_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  login_domain text NOT NULL,
  login_email_pattern text NOT NULL DEFAULT 'first.last',
  free_requires_own_email boolean NOT NULL DEFAULT true,
  paid_allows_generated_email boolean NOT NULL DEFAULT true,
  one_to_one_allows_generated_email boolean NOT NULL DEFAULT true,
  phone_soft_duplicate_check boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.org_identity_config TO authenticated;
GRANT ALL ON public.org_identity_config TO service_role;

ALTER TABLE public.org_identity_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read identity config" ON public.org_identity_config;
CREATE POLICY "Staff can read identity config"
  ON public.org_identity_config FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_admissions')
    OR public.has_role(auth.uid(), 'admin_division')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_identity_config_default
  ON public.org_identity_config (is_default) WHERE is_default;

DROP TRIGGER IF EXISTS trg_org_identity_config_updated ON public.org_identity_config;
CREATE TRIGGER trg_org_identity_config_updated
  BEFORE UPDATE ON public.org_identity_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.org_identity_config (org_id, login_domain, is_default)
SELECT (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1), 'alqurantimeacademy.com', true
WHERE NOT EXISTS (SELECT 1 FROM public.org_identity_config WHERE is_default);