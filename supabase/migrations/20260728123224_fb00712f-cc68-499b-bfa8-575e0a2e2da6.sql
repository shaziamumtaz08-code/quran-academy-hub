-- Remove credential columns from realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.zoom_accounts;

-- Column-level access: logged-in users can never read Zoom API credentials
REVOKE SELECT, INSERT, UPDATE ON public.zoom_accounts FROM authenticated;
GRANT SELECT (id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link,
              is_active, last_validated_at, notes, created_at, updated_at)
  ON public.zoom_accounts TO authenticated;
GRANT UPDATE (zoom_account_email, tier, meeting_link, is_active, notes, updated_at)
  ON public.zoom_accounts TO authenticated;
GRANT INSERT (teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active, notes)
  ON public.zoom_accounts TO authenticated;
GRANT DELETE ON public.zoom_accounts TO authenticated;
GRANT ALL ON public.zoom_accounts TO service_role;

-- Safe view for read access
GRANT SELECT ON public.zoom_accounts_safe TO authenticated;
ALTER VIEW public.zoom_accounts_safe SET (security_invoker = on);