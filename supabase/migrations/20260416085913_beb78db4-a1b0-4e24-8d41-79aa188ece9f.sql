ALTER TABLE public.session_recordings 
  ADD COLUMN IF NOT EXISTS virtual_session_id UUID,
  ALTER COLUMN session_id DROP NOT NULL;