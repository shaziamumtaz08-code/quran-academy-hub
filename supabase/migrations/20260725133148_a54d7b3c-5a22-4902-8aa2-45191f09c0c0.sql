
-- 1) app_settings: only expose whitelisted public keys to authenticated users; admins keep full access via existing policy.
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.app_settings;
CREATE POLICY "Authenticated users can view public settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (setting_key IN ('featured_spotlight', 'default_signup_context'));

-- 2) organizations: restrict the sensitive `settings` jsonb column via column privileges.
--    Non-admin clients can still read name/logo/etc. Admins read/write settings via SECURITY DEFINER RPCs below.
REVOKE SELECT (settings) ON public.organizations FROM anon, authenticated;
REVOKE UPDATE (settings) ON public.organizations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_organization_settings(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _s jsonb;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT settings INTO _s FROM public.organizations WHERE id = _org_id;
  RETURN COALESCE(_s, '{}'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_organization_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_organization_settings(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_organization_settings(_org_id uuid, _settings jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.organizations
     SET settings = COALESCE(_settings, '{}'::jsonb),
         updated_at = now()
   WHERE id = _org_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_organization_settings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_organization_settings(uuid, jsonb) TO authenticated;

-- 3) attendance_audit_log: block direct client inserts. The SECURITY DEFINER trigger bypasses RLS.
DROP POLICY IF EXISTS "System can insert attendance audit" ON public.attendance_audit_log;
CREATE POLICY "No direct client inserts on attendance audit"
  ON public.attendance_audit_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- 4) leads: keep public form but reject empty/junk submissions.
DROP POLICY IF EXISTS "Anonymous can create leads" ON public.leads;
CREATE POLICY "Public can submit leads"
  ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND for_whom IN ('self','child','other')
    AND status = 'new'
  );

-- 5) registration_submissions: keep public form but require valid foreign keys.
DROP POLICY IF EXISTS "Anyone can submit registration" ON public.registration_submissions;
CREATE POLICY "Public can submit registrations"
  ON public.registration_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    form_id IS NOT NULL
    AND course_id IS NOT NULL
    AND status = 'new'
    AND EXISTS (SELECT 1 FROM public.registration_forms rf WHERE rf.id = form_id)
  );

-- 6) Revoke EXECUTE from anon on SECURITY DEFINER functions that are not intended to be publicly callable.
--    Trigger functions never need EXECUTE grants; internal helpers should require an authenticated caller.
REVOKE EXECUTE ON FUNCTION public.normalize_phone(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_payment_proof(uuid[], text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_payment_proof(uuid, text) FROM PUBLIC, anon;

-- Trigger functions: revoke EXECUTE from every non-superuser role. Triggers still fire — GRANT is unrelated.
REVOKE EXECUTE ON FUNCTION public.fn_log_assignment_window_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_window_change_log_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_recording_retention() FROM PUBLIC, anon, authenticated;
