-- Add period_from and period_to columns to fee_invoices for payment period tracking
ALTER TABLE public.fee_invoices ADD COLUMN IF NOT EXISTS period_from date;
ALTER TABLE public.fee_invoices ADD COLUMN IF NOT EXISTS period_to date;