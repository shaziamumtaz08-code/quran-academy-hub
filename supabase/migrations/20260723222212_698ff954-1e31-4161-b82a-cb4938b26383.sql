ALTER TABLE public.invoice_adjustments DISABLE TRIGGER trg_invoice_adjustments_no_update;
DELETE FROM public.invoice_adjustments WHERE invoice_id IN ('7dc861ac-e873-4108-8aa5-860aeb142547','4edc6bb4-e8bf-42c3-b8f3-86b3417c0b1a');
DELETE FROM public.payment_transactions WHERE invoice_id IN ('7dc861ac-e873-4108-8aa5-860aeb142547','4edc6bb4-e8bf-42c3-b8f3-86b3417c0b1a');
DELETE FROM public.fee_invoices WHERE id IN ('7dc861ac-e873-4108-8aa5-860aeb142547','4edc6bb4-e8bf-42c3-b8f3-86b3417c0b1a');
ALTER TABLE public.invoice_adjustments ENABLE TRIGGER trg_invoice_adjustments_no_update;