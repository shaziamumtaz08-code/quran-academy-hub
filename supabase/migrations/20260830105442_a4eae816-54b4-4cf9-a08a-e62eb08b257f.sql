ALTER TABLE public.zoom_vault_accounts
  ADD COLUMN IF NOT EXISTS zoom_account_id uuid REFERENCES public.zoom_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_vault_accounts_zoom_account_id
  ON public.zoom_vault_accounts(zoom_account_id);

UPDATE public.zoom_vault_accounts v
SET zoom_account_id = a.id
FROM public.zoom_accounts a
WHERE lower(a.zoom_account_email) = lower(v.zoom_email)
  AND v.zoom_account_id IS NULL;