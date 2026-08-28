ALTER TABLE public.zoom_accounts ADD COLUMN IF NOT EXISTS meeting_passcode text;

-- Backfill: many saved links carry the plain numeric/short passcode in ?pwd=
-- instead of Zoom's long encrypted token, which makes Zoom prompt for a passcode.
UPDATE public.zoom_accounts
SET meeting_passcode = substring(meeting_link from 'pwd=([^&]+)')
WHERE meeting_passcode IS NULL
  AND meeting_link ~ 'pwd='
  AND length(substring(meeting_link from 'pwd=([^&]+)')) < 20;