-- Add 'left' as a valid status for student_teacher_assignments
ALTER TABLE public.student_teacher_assignments DROP CONSTRAINT IF EXISTS student_teacher_assignments_status_check;
ALTER TABLE public.student_teacher_assignments ADD CONSTRAINT student_teacher_assignments_status_check CHECK (status IN ('active', 'paused', 'completed', 'left'));