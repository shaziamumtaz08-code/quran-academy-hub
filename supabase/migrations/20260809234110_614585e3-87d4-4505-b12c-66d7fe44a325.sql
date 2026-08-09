ALTER TABLE public.zoom_accounts
  ADD COLUMN IF NOT EXISTS credential_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS credential_error text,
  ADD COLUMN IF NOT EXISTS credential_checked_at timestamptz;

ALTER TABLE public.zoom_accounts
  DROP CONSTRAINT IF EXISTS zoom_accounts_credential_status_check;

ALTER TABLE public.zoom_accounts
  ADD CONSTRAINT zoom_accounts_credential_status_check
  CHECK (credential_status IN ('unverified','verified','failed'));

UPDATE public.zoom_accounts
SET credential_status = 'verified',
    credential_checked_at = COALESCE(last_validated_at, now())
WHERE zoom_user_id IS NOT NULL
  AND zoom_account_id_cred IS NOT NULL
  AND zoom_client_id IS NOT NULL
  AND zoom_client_secret IS NOT NULL
  AND credential_status = 'unverified';