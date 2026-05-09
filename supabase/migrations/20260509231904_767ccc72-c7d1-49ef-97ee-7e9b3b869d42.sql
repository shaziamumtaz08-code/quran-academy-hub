ALTER TABLE public.student_teacher_assignments
  DROP CONSTRAINT IF EXISTS student_teacher_assignments_status_check;

ALTER TABLE public.student_teacher_assignments
  ADD CONSTRAINT student_teacher_assignments_status_check
  CHECK (status = ANY (ARRAY['active'::assignment_status, 'paused'::assignment_status, 'on_hold'::assignment_status, 'completed'::assignment_status, 'left'::assignment_status]));