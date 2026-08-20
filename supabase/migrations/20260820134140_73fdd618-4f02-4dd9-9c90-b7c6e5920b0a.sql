REVOKE SELECT (webhook_secret) ON public.courses FROM anon;
REVOKE SELECT (webhook_secret) ON public.courses FROM authenticated;