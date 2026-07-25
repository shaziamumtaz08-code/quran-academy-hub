
DROP VIEW IF EXISTS public.zoom_accounts_safe;
CREATE VIEW public.zoom_accounts_safe
WITH (security_invoker = true) AS
SELECT id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link,
       is_active, last_validated_at, notes, created_at, updated_at
FROM public.zoom_accounts;
GRANT SELECT ON public.zoom_accounts_safe TO authenticated;
