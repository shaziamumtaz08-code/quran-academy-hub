ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check
  CHECK (status = ANY (ARRAY['present'::text, 'student_absent'::text, 'student_leave'::text, 'teacher_absent'::text, 'teacher_leave'::text, 'rescheduled'::text, 'student_rescheduled'::text, 'holiday'::text]));