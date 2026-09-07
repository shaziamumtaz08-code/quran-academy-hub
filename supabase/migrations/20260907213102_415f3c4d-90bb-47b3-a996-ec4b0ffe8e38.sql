ALTER TABLE public.vcr_call_recordings
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_backed_up_at timestamptz;