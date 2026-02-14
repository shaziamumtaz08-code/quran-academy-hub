
-- Payment transactions table for detailed payment records
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.fee_invoices(id),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  amount_foreign NUMERIC NOT NULL DEFAULT 0,
  currency_foreign TEXT NOT NULL DEFAULT 'USD',
  amount_local NUMERIC NOT NULL DEFAULT 0,
  currency_local TEXT NOT NULL DEFAULT 'PKR',
  effective_rate NUMERIC,
  resolution_type TEXT NOT NULL DEFAULT 'full',
  shortfall_amount NUMERIC NOT NULL DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access on payment_transactions"
  ON public.payment_transactions FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view payment_transactions"
  ON public.payment_transactions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Add forgiven_amount to fee_invoices for write-off tracking
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS forgiven_amount NUMERIC NOT NULL DEFAULT 0;

-- Storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment receipts
CREATE POLICY "Anyone can view payment receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-receipts');

CREATE POLICY "Authenticated users can upload payment receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update payment receipts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-receipts' AND auth.role() = 'authenticated');
