ALTER TABLE public.zoom_accounts
  ADD COLUMN IF NOT EXISTS webhook_app_slug text,
  ADD COLUMN IF NOT EXISTS webhook_secret_token text;

CREATE UNIQUE INDEX IF NOT EXISTS zoom_accounts_webhook_app_slug_key
  ON public.zoom_accounts (webhook_app_slug)
  WHERE webhook_app_slug IS NOT NULL;