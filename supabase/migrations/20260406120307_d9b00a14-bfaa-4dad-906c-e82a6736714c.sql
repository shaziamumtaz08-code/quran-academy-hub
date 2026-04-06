
-- Add transfer/substitute columns to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments 
  ADD COLUMN IF NOT EXISTS parent_assignment_id uuid REFERENCES public.student_teacher_assignments(id),
  ADD COLUMN IF NOT EXISTS transfer_type text DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS substitute_end_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.student_teacher_assignments.parent_assignment_id IS 'For temporary substitutes: references the original assignment that is suspended';
COMMENT ON COLUMN public.student_teacher_assignments.transfer_type IS 'permanent or substitute';
COMMENT ON COLUMN public.student_teacher_assignments.substitute_end_date IS 'When the temporary substitute period ends';

-- Index for looking up substitutes
CREATE INDEX IF NOT EXISTS idx_sta_parent_assignment ON public.student_teacher_assignments(parent_assignment_id) WHERE parent_assignment_id IS NOT NULL;
