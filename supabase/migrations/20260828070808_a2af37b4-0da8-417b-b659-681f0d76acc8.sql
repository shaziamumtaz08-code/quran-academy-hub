UPDATE public.zoom_accounts SET zoom_user_id = 'okE0z7n1SL2Ee4DzaytXqw', updated_at = now() WHERE zoom_account_email = 'shazia.aqt@gmail.com';

REVOKE SELECT (webhook_secret) ON public.courses FROM anon;
REVOKE SELECT (webhook_secret) ON public.courses FROM authenticated;