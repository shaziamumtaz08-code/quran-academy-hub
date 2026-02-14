
-- Step 1: Add days_per_week to fee_packages, rename amount to base_amount conceptually (column stays 'amount' for backward compat)
ALTER TABLE public.fee_packages ADD COLUMN IF NOT EXISTS days_per_week integer NOT NULL DEFAULT 5;

-- Step 2: Remove billing_cycle and subject_id from fee_packages (no longer needed for new pricing model)
-- We keep subject_id but make it truly optional (it already is nullable)
-- We keep billing_cycle for backward compat but it defaults to monthly

-- Step 3: Add billing fields to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments 
  ADD COLUMN IF NOT EXISTS fee_package_id uuid REFERENCES public.fee_packages(id),
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS discount_id uuid REFERENCES public.discount_rules(id),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS calculated_monthly_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_month_prorated_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_custom_override boolean NOT NULL DEFAULT false;
