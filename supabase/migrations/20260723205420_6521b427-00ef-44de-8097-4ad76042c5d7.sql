
ALTER TABLE public.invoice_adjustments DISABLE TRIGGER USER;

WITH dups AS (
  SELECT id FROM public.fee_invoices
  WHERE student_id = 'bc9692af-16ec-430a-91fd-14b8a2a1e89f'
    AND status = 'pending'
    AND billing_month IN ('2026-02','2026-03','2026-04')
)
DELETE FROM public.invoice_adjustments WHERE invoice_id IN (SELECT id FROM dups);

DELETE FROM public.payment_transactions
WHERE invoice_id IN (
  SELECT id FROM public.fee_invoices
  WHERE student_id = 'bc9692af-16ec-430a-91fd-14b8a2a1e89f'
    AND status = 'pending'
    AND billing_month IN ('2026-02','2026-03','2026-04')
);

DELETE FROM public.fee_invoices
WHERE student_id = 'bc9692af-16ec-430a-91fd-14b8a2a1e89f'
  AND status = 'pending'
  AND billing_month IN ('2026-02','2026-03','2026-04');

ALTER TABLE public.invoice_adjustments ENABLE TRIGGER USER;
