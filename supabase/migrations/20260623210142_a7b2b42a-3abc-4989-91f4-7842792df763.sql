ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS repeat_reason text,
  ADD COLUMN IF NOT EXISTS repeat_reason_note text;