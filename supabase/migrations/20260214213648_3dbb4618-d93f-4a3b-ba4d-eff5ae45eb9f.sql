-- Add effective_to_date to student_teacher_assignments for pro-rated salary calculation
ALTER TABLE public.student_teacher_assignments 
ADD COLUMN IF NOT EXISTS effective_to_date date;