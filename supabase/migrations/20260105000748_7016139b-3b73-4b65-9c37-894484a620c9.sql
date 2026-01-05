-- Create assignment lifecycle status enum
CREATE TYPE assignment_status AS ENUM ('active', 'paused', 'completed');

-- Add status to student_teacher_assignments with default 'active'
ALTER TABLE public.student_teacher_assignments 
ADD COLUMN status assignment_status NOT NULL DEFAULT 'active';

-- Remove legacy scheduling fields from assignments (scheduling is now separate via schedules table)
ALTER TABLE public.student_teacher_assignments 
DROP COLUMN IF EXISTS schedule_time,
DROP COLUMN IF EXISTS schedule_day;

-- Add assignment_id to student_monthly_plans
ALTER TABLE public.student_monthly_plans 
ADD COLUMN assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_monthly_plans_assignment_id ON public.student_monthly_plans(assignment_id);
CREATE INDEX idx_assignments_status ON public.student_teacher_assignments(status);

-- Backfill existing plans: match by student_id + teacher_id + subject_id
UPDATE public.student_monthly_plans smp
SET assignment_id = sta.id
FROM public.student_teacher_assignments sta
WHERE smp.student_id = sta.student_id 
  AND smp.teacher_id = sta.teacher_id
  AND (smp.subject_id = sta.subject_id OR (smp.subject_id IS NULL AND sta.subject_id IS NULL))
  AND smp.assignment_id IS NULL;