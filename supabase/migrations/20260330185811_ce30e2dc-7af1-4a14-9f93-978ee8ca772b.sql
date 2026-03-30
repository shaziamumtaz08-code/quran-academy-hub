-- Allow admin_fees role to view fee_invoices
CREATE POLICY "Admin fees can view fee_invoices"
ON public.fee_invoices
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_fees'::app_role)
);

-- Allow admin_fees role to manage fee_invoices
CREATE POLICY "Admin fees can manage fee_invoices"
ON public.fee_invoices
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin_fees'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin_fees'::app_role)
);

-- Also grant admin_fees access to payment_transactions for receipts
CREATE POLICY "Admin fees can view payment_transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_fees'::app_role)
);

CREATE POLICY "Admin fees can manage payment_transactions"
ON public.payment_transactions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin_fees'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin_fees'::app_role)
);