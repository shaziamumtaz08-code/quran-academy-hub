ALTER TABLE public.student_teacher_assignments
  DROP CONSTRAINT IF EXISTS student_teacher_assignments_student_id_teacher_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sta_active_student_teacher
  ON public.student_teacher_assignments (student_id, teacher_id)
  WHERE status = 'active' AND effective_to_date IS NULL;