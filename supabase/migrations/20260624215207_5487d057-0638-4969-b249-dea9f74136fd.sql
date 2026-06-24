
-- Allow students (and linked parents) to view their own payment-receipts objects.
-- Receipts live as objects in the private 'payment-receipts' bucket; payment_transactions.receipt_url
-- contains the full URL whose path ends with the object's storage name.
CREATE POLICY "Students and parents view own payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1
      FROM public.payment_transactions pt
      JOIN public.fee_invoices fi ON fi.id = pt.invoice_id
     WHERE pt.receipt_url LIKE '%' || storage.objects.name
       AND (
         fi.student_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.student_parent_links spl
            WHERE spl.student_id = fi.student_id
              AND spl.parent_id = auth.uid()
         )
       )
  )
);
