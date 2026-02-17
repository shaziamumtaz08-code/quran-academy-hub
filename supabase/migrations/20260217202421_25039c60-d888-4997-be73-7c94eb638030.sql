
-- Add invoice_number to expenses table (receipt_url already exists)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS invoice_number text;

-- Add invoice_number and receipt_url to salary_payouts table
ALTER TABLE public.salary_payouts ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.salary_payouts ADD COLUMN IF NOT EXISTS receipt_url text;

-- Add status_effective_date to student_teacher_assignments for tracking when status changes take effect
ALTER TABLE public.student_teacher_assignments ADD COLUMN IF NOT EXISTS status_effective_date date;
