
-- Part 1: Add teacher payout fields to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments
  ADD COLUMN IF NOT EXISTS payout_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_type text DEFAULT 'monthly' CHECK (payout_type IN ('monthly', 'per_class')),
  ADD COLUMN IF NOT EXISTS effective_from_date date;

-- Part 2: Create assignment_history table to track teacher reassignments
CREATE TABLE public.assignment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can do everything
CREATE POLICY "Admins full access on assignment_history"
  ON public.assignment_history
  FOR ALL
  USING (
    public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin_academic')
    OR public.has_role(auth.uid(), 'admin_fees')
  );

-- RLS: Teachers can view their own history
CREATE POLICY "Teachers view own assignment_history"
  ON public.assignment_history
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_assignment_history_assignment ON public.assignment_history(assignment_id);
CREATE INDEX idx_assignment_history_teacher ON public.assignment_history(teacher_id);

-- Part 3: Seed initial history records from existing assignments
INSERT INTO public.assignment_history (assignment_id, teacher_id, student_id, subject_id, started_at)
SELECT id, teacher_id, student_id, subject_id, created_at
FROM public.student_teacher_assignments;
