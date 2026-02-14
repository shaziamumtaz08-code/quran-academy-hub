
-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'overdue');

-- Create fee_invoices table
CREATE TABLE public.fee_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_month TEXT NOT NULL, -- e.g. '2026-02'
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  remark TEXT,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, billing_month)
);

-- Enable RLS
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;

-- RLS: Super admin full access
CREATE POLICY "Super admins have full access to fee_invoices"
  ON public.fee_invoices FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS: Admin read access
CREATE POLICY "Admins can read fee_invoices"
  ON public.fee_invoices FOR SELECT
  USING (public.is_admin(auth.uid()));

-- RLS: Admin can insert/update
CREATE POLICY "Admins can manage fee_invoices"
  ON public.fee_invoices FOR ALL
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_fee_invoices_updated_at
  BEFORE UPDATE ON public.fee_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
