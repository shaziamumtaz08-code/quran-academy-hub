
-- Keep fee_invoices.amount_paid in sync with the payment_transactions ledger.
-- Root cause of Zayan's phantom "PKR 3,000 arrears" on the parent dashboard:
-- two 3,000 PKR transactions were recorded against invoice 6dfff1d8-…, but
-- invoice.amount_paid was only 3,000 (stale). The student portal uses the
-- ledger sum so it displayed "cleared"; the parent card reads amount_paid so
-- it still showed arrears.

CREATE OR REPLACE FUNCTION public.sync_invoice_from_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_invoice UUID;
  ledger_sum NUMERIC;
  inv RECORD;
BEGIN
  target_invoice := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF target_invoice IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount_foreign), 0) INTO ledger_sum
  FROM public.payment_transactions
  WHERE invoice_id = target_invoice;

  SELECT amount, COALESCE(forgiven_amount, 0) AS forgiven_amount, status
    INTO inv
  FROM public.fee_invoices
  WHERE id = target_invoice;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.fee_invoices
  SET
    amount_paid = ledger_sum,
    status = CASE
      WHEN status IN ('waived', 'adjusted') THEN status
      WHEN ledger_sum + COALESCE(inv.forgiven_amount, 0) >= inv.amount - 0.01 THEN 'paid'
      WHEN ledger_sum > 0.01 THEN 'partially_paid'
      WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END,
    paid_at = CASE
      WHEN ledger_sum + COALESCE(inv.forgiven_amount, 0) >= inv.amount - 0.01
        THEN COALESCE(paid_at, now())
      ELSE NULL
    END
  WHERE id = target_invoice;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_from_transactions ON public.payment_transactions;
CREATE TRIGGER trg_sync_invoice_from_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_transactions();

-- One-time backfill: recompute amount_paid + status for every invoice that
-- has any transactions, so historical stale rows (like Zayan's Jan 2026) are
-- corrected.
DO $$
DECLARE
  r RECORD;
  ledger_sum NUMERIC;
BEGIN
  FOR r IN
    SELECT DISTINCT fi.id, fi.amount, COALESCE(fi.forgiven_amount, 0) AS forgiven_amount,
                    fi.status, fi.due_date
    FROM public.fee_invoices fi
    JOIN public.payment_transactions pt ON pt.invoice_id = fi.id
  LOOP
    SELECT COALESCE(SUM(amount_foreign), 0) INTO ledger_sum
    FROM public.payment_transactions
    WHERE invoice_id = r.id;

    UPDATE public.fee_invoices
    SET amount_paid = ledger_sum,
        status = CASE
          WHEN r.status IN ('waived', 'adjusted') THEN r.status
          WHEN ledger_sum + r.forgiven_amount >= r.amount - 0.01 THEN 'paid'
          WHEN ledger_sum > 0.01 THEN 'partially_paid'
          WHEN r.due_date IS NOT NULL AND r.due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'pending'
        END,
        paid_at = CASE
          WHEN ledger_sum + r.forgiven_amount >= r.amount - 0.01
            THEN COALESCE(paid_at, now())
          ELSE NULL
        END
    WHERE id = r.id;
  END LOOP;
END $$;
