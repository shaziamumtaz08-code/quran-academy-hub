-- Add subject and schedule columns to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS schedule_day text,
ADD COLUMN IF NOT EXISTS schedule_time time without time zone;