ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'clarification_required';
ALTER TABLE public.student_monthly_plans ADD COLUMN IF NOT EXISTS review_note text;