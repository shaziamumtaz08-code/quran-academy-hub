DROP POLICY IF EXISTS "Teachers view own zoom accounts" ON public.zoom_accounts;

REVOKE ALL ON public.zoom_accounts FROM anon;
REVOKE ALL ON public.zoom_accounts FROM authenticated;
REVOKE ALL ON public.zoom_accounts FROM service_role;

REVOKE ALL (
  id,
  teacher_id,
  zoom_account_email,
  zoom_user_id,
  tier,
  meeting_link,
  is_active,
  last_validated_at,
  notes,
  zoom_account_id_cred,
  zoom_client_id,
  zoom_client_secret,
  created_at,
  updated_at
) ON public.zoom_accounts FROM anon;

REVOKE ALL (
  id,
  teacher_id,
  zoom_account_email,
  zoom_user_id,
  tier,
  meeting_link,
  is_active,
  last_validated_at,
  notes,
  zoom_account_id_cred,
  zoom_client_id,
  zoom_client_secret,
  created_at,
  updated_at
) ON public.zoom_accounts FROM authenticated;

GRANT ALL ON public.zoom_accounts TO service_role;

GRANT SELECT (
  id,
  teacher_id,
  zoom_account_email,
  zoom_user_id,
  tier,
  meeting_link,
  is_active,
  last_validated_at,
  notes,
  created_at,
  updated_at
) ON public.zoom_accounts TO authenticated;

GRANT UPDATE (
  teacher_id,
  zoom_account_email,
  zoom_user_id,
  tier,
  meeting_link,
  is_active,
  last_validated_at,
  notes
) ON public.zoom_accounts TO authenticated;

GRANT DELETE ON public.zoom_accounts TO authenticated;

DROP PUBLICATION IF EXISTS supabase_realtime;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'zoom_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.zoom_accounts;
  END IF;
END $$;