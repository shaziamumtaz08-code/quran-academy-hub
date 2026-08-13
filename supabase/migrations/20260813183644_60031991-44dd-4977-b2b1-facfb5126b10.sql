ALTER TABLE public.salary_adjustments DROP CONSTRAINT IF EXISTS salary_adjustments_adjustment_type_check;
ALTER TABLE public.salary_adjustments ADD CONSTRAINT salary_adjustments_adjustment_type_check
CHECK (adjustment_type = ANY (ARRAY['bonus'::text, 'deduction'::text, 'expense'::text, 'allowance'::text, 'rounding'::text, 'correction'::text]));