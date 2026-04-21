-- STEP 1: SCHEMA EXTENSION
ALTER TABLE public.user_context
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS primary_role    text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_context ALTER COLUMN branch_id   DROP NOT NULL;
ALTER TABLE public.user_context ALTER COLUMN division_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_context_org_user
  ON public.user_context(organization_id, user_id);

DROP TRIGGER IF EXISTS trg_user_context_updated_at ON public.user_context;
CREATE TRIGGER trg_user_context_updated_at
  BEFORE UPDATE ON public.user_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BACKFILL existing rows
UPDATE public.user_context
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

UPDATE public.user_context uc
SET primary_role = (
  SELECT ur.role::text FROM public.user_roles ur
  WHERE ur.user_id = uc.user_id
  ORDER BY CASE ur.role::text
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'admin_admissions' THEN 3
    WHEN 'admin_fees' THEN 3
    WHEN 'admin_academic' THEN 3
    WHEN 'teacher' THEN 4
    WHEN 'examiner' THEN 5
    WHEN 'parent' THEN 6
    WHEN 'student' THEN 7
    ELSE 99
  END
  LIMIT 1
)
WHERE primary_role IS NULL;

-- STEP 2: SHARED RPC (multi-context conflict key)
CREATE OR REPLACE FUNCTION public.ensure_user_context(
  p_user_id         uuid,
  p_organization_id uuid,
  p_branch_id       uuid DEFAULT NULL,
  p_division_id     uuid DEFAULT NULL,
  p_primary_role    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_has_any boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE WARNING 'ensure_user_context skipped: user_id=% org_id=%', p_user_id, p_organization_id;
    RETURN NULL;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_context WHERE user_id = p_user_id) INTO v_has_any;

  IF p_branch_id IS NOT NULL AND p_division_id IS NOT NULL THEN
    INSERT INTO public.user_context
      (user_id, organization_id, branch_id, division_id, primary_role, is_default)
    VALUES
      (p_user_id, p_organization_id, p_branch_id, p_division_id, p_primary_role, NOT v_has_any)
    ON CONFLICT (user_id, branch_id, division_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      primary_role    = COALESCE(EXCLUDED.primary_role, public.user_context.primary_role),
      updated_at      = now()
    RETURNING id INTO v_id;
  ELSE
    SELECT id INTO v_id FROM public.user_context
      WHERE user_id = p_user_id AND organization_id = p_organization_id
        AND branch_id IS NULL AND division_id IS NULL LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO public.user_context
        (user_id, organization_id, branch_id, division_id, primary_role, is_default)
      VALUES
        (p_user_id, p_organization_id, NULL, NULL, p_primary_role, NOT v_has_any)
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.user_context
        SET primary_role = COALESCE(p_primary_role, primary_role), updated_at = now()
        WHERE id = v_id;
    END IF;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_user_context TO authenticated, service_role;

-- STEP 3: SEED default_signup_context
INSERT INTO public.app_settings (setting_key, setting_value, description)
SELECT
  'default_signup_context',
  jsonb_build_object(
    'organization_id', (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1),
    'branch_id',       (SELECT id FROM public.branches  WHERE is_active = true ORDER BY created_at LIMIT 1),
    'division_id',     (SELECT id FROM public.divisions WHERE is_active = true ORDER BY created_at LIMIT 1)
  ),
  'Default tenant context for public self-signup. Edit when onboarding new tenants.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE setting_key = 'default_signup_context');

-- STEP 5: BACKFILL ORPHAN PROFILES (resolve branch/div via courses)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    WITH orphans AS (
      SELECT p.id AS user_id
      FROM public.profiles p
      LEFT JOIN public.user_context uc ON uc.user_id = p.id
      WHERE uc.user_id IS NULL
    ),
    derived AS (
      SELECT DISTINCT ON (o.user_id)
        o.user_id,
        c.branch_id,
        c.division_id
      FROM orphans o
      LEFT JOIN public.course_class_students ccs ON ccs.student_id = o.user_id
      LEFT JOIN public.course_class_staff    ccst ON ccst.user_id  = o.user_id
      LEFT JOIN public.course_classes        cc   ON cc.id = COALESCE(ccs.class_id, ccst.class_id)
      LEFT JOIN public.courses               c    ON c.id = cc.course_id
      ORDER BY o.user_id, cc.created_at DESC NULLS LAST
    )
    SELECT * FROM derived
  LOOP
    PERFORM public.ensure_user_context(
      r.user_id,
      (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1),
      r.branch_id,
      r.division_id,
      (SELECT ur.role::text FROM public.user_roles ur
        WHERE ur.user_id = r.user_id
        ORDER BY CASE ur.role::text
          WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
          WHEN 'admin_admissions' THEN 3 WHEN 'admin_fees' THEN 3 WHEN 'admin_academic' THEN 3
          WHEN 'teacher' THEN 4 WHEN 'examiner' THEN 5 WHEN 'parent' THEN 6 WHEN 'student' THEN 7
          ELSE 99 END
        LIMIT 1)
    );
  END LOOP;
END $$;

-- STEP 6: ROLE CONFLICT RESOLUTION
DELETE FROM public.user_roles
WHERE user_id = '40d969b5-dd67-4629-a8ca-4ce7bc1c0cce'
  AND role = 'admin';