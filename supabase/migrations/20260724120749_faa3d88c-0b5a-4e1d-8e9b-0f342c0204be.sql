
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_file_size_mb numeric,
  ADD COLUMN IF NOT EXISTS compression_status text;

-- Backfill retention for already-stored recordings
UPDATE public.live_sessions
SET retention_expires_at = recording_fetched_at + interval '60 days'
WHERE recording_status = 'ready'
  AND recording_fetched_at IS NOT NULL
  AND retention_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_recording_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recording_status = 'ready'
     AND NEW.recording_fetched_at IS NOT NULL
     AND NEW.retention_expires_at IS NULL
  THEN
    NEW.retention_expires_at := NEW.recording_fetched_at + interval '60 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_recording_retention ON public.live_sessions;
CREATE TRIGGER trg_set_recording_retention
BEFORE INSERT OR UPDATE OF recording_status, recording_fetched_at
ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_recording_retention();
