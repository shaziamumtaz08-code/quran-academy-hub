CREATE OR REPLACE FUNCTION public.get_org_default_currency()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((o.settings->>'default_currency'), 'PKR')
  FROM public.organizations o
  ORDER BY o.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_org_default_currency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_default_currency() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_zoom_seat_status()
RETURNS TABLE (
  id uuid,
  teacher_id uuid,
  zoom_account_email text,
  zoom_user_id text,
  tier zoom_account_tier,
  is_active boolean,
  last_validated_at timestamptz,
  credential_status text,
  credential_error text,
  has_credentials boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id, z.teacher_id, z.zoom_account_email, z.zoom_user_id, z.tier,
         z.is_active, z.last_validated_at,
         z.credential_status::text, z.credential_error,
         (z.zoom_account_id_cred IS NOT NULL AND z.zoom_client_id IS NOT NULL AND z.zoom_client_secret IS NOT NULL) AS has_credentials
  FROM public.zoom_accounts z
  WHERE z.is_active = true
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  ORDER BY z.created_at
$$;

REVOKE ALL ON FUNCTION public.get_zoom_seat_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_zoom_seat_status() TO authenticated, service_role;