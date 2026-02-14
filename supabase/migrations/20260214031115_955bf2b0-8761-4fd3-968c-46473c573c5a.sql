
-- Add discount audit columns to student_billing_plans
ALTER TABLE public.student_billing_plans
ADD COLUMN IF NOT EXISTS manual_discount_reason text,
ADD COLUMN IF NOT EXISTS global_discount_id uuid REFERENCES public.discount_rules(id);
