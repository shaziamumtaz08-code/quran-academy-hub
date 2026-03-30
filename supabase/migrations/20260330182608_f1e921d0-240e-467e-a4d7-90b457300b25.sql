
-- Add tracking flags to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments
  ADD COLUMN IF NOT EXISTS requires_schedule boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_planning boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_attendance boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.student_teacher_assignments.requires_schedule IS 'When false, excluded from missing schedule warnings';
COMMENT ON COLUMN public.student_teacher_assignments.requires_planning IS 'When false, excluded from missing plan reminders';
COMMENT ON COLUMN public.student_teacher_assignments.requires_attendance IS 'When false, excluded from attendance tracking';
