-- Allow students to read their own payment_transactions
CREATE POLICY "Students view own payment_transactions"
  ON public.payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fee_invoices fi
      WHERE fi.id = payment_transactions.invoice_id
        AND fi.student_id = auth.uid()
    )
  );

-- Allow parents to read payment_transactions for their linked children
CREATE POLICY "Parents view children payment_transactions"
  ON public.payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.fee_invoices fi
      JOIN public.student_parent_links spl ON spl.student_id = fi.student_id
      WHERE fi.id = payment_transactions.invoice_id
        AND spl.parent_id = auth.uid()
    )
  );