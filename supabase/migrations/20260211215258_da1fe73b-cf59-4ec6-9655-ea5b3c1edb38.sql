-- Add division_id to student_monthly_plans
ALTER TABLE public.student_monthly_plans
  ADD COLUMN division_id UUID REFERENCES public.divisions(id);

-- Create index for performance
CREATE INDEX idx_monthly_plans_division ON public.student_monthly_plans(division_id);

-- Backfill all existing rows to default 1:1 division
UPDATE public.student_monthly_plans
SET division_id = '00000000-0000-0000-0000-000000000003'
WHERE division_id IS NULL;