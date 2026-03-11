-- Add join-time tracking columns to attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS teacher_join_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_join_time TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.attendance.teacher_join_time IS 'Timestamp when teacher clicked Start Class, auto-recorded';
COMMENT ON COLUMN public.attendance.student_join_time IS 'Timestamp when student clicked Join Class, auto-recorded';