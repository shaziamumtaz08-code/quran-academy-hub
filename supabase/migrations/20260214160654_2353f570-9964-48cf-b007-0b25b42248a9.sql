
-- Add new invoice statuses
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'waived';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'adjusted';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'voided';

-- Create invoice adjustments audit table
CREATE TABLE public.invoice_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.fee_invoices(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'edit_amount', 'mark_unpaid', 'apply_discount', 'waive_fee', 'reverse_payment', 'void_invoice'
  previous_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  admin_id UUID REFERENCES auth.users(id),
  admin_name TEXT NOT NULL,
  admin_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view/insert
CREATE POLICY "Admins can view invoice adjustments"
  ON public.invoice_adjustments FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can insert invoice adjustments"
  ON public.invoice_adjustments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_invoice_adjustments_invoice_id ON public.invoice_adjustments(invoice_id);
CREATE INDEX idx_invoice_adjustments_created_at ON public.invoice_adjustments(created_at DESC);
