
-- Create student_billing_plans table
CREATE TABLE public.student_billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  base_package_id UUID REFERENCES public.fee_packages(id),
  assignment_id UUID REFERENCES public.student_teacher_assignments(id),
  session_duration INTEGER NOT NULL DEFAULT 30,
  duration_surcharge NUMERIC NOT NULL DEFAULT 0,
  flat_discount NUMERIC NOT NULL DEFAULT 0,
  net_recurring_fee NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_billing_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admins full access on billing plans"
  ON public.student_billing_plans FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view billing plans"
  ON public.student_billing_plans FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_student_billing_plans_updated_at
  BEFORE UPDATE ON public.student_billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add plan_id and amount_paid to fee_invoices
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.student_billing_plans(id),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0;

-- Add 'partially_paid' to the invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
