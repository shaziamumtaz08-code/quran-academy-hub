
-- 1) Versioning columns
ALTER TABLE public.salary_payouts
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS superseded_by_payout_id uuid REFERENCES public.salary_payouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_revised boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revises_payout_id uuid REFERENCES public.salary_payouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prior_paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_reason text;

CREATE INDEX IF NOT EXISTS idx_salary_payouts_archived ON public.salary_payouts(is_archived);
CREATE INDEX IF NOT EXISTS idx_salary_payouts_revises ON public.salary_payouts(revises_payout_id);

-- 2) Update teacher view policy to hide archived rows from teachers
DROP POLICY IF EXISTS "Teachers can view own salary_payouts" ON public.salary_payouts;
CREATE POLICY "Teachers can view own salary_payouts"
  ON public.salary_payouts FOR SELECT
  USING (teacher_id = auth.uid() AND is_archived = false);

-- 3) revise_salary_payout RPC — archive + insert pattern
CREATE OR REPLACE FUNCTION public.revise_salary_payout(
  _payout_id uuid,
  _base_salary numeric,
  _extra_class_amount numeric,
  _adjustment_amount numeric,
  _expense_amount numeric,
  _deductions numeric,
  _calculation_json jsonb,
  _change_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old public.salary_payouts%ROWTYPE;
  _new_id uuid;
  _gross numeric;
  _net numeric;
  _delta numeric;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _old FROM public.salary_payouts WHERE id = _payout_id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'payout not found'; END IF;
  IF _old.is_archived THEN RAISE EXCEPTION 'payout already archived'; END IF;

  _gross := COALESCE(_base_salary,0) + COALESCE(_extra_class_amount,0) + COALESCE(_adjustment_amount,0) + COALESCE(_expense_amount,0);
  _net := _gross - COALESCE(_deductions,0);
  _delta := _net - COALESCE(_old.amount_paid, 0);

  -- Archive the old row (immutable thereafter)
  UPDATE public.salary_payouts
     SET is_archived = true,
         archived_at = now(),
         archive_reason = COALESCE(_change_reason, 'Salary revised')
   WHERE id = _payout_id;

  -- Insert the revised row, carrying prior paid amount
  INSERT INTO public.salary_payouts(
    teacher_id, salary_month, base_salary, extra_class_amount, adjustment_amount,
    expense_amount, gross_salary, deductions, net_salary, calculation_json,
    status, amount_paid, prior_paid_amount,
    is_revised, revises_payout_id, change_reason,
    invoice_number, recipient_account_snapshot, payment_channel
  ) VALUES (
    _old.teacher_id, _old.salary_month, _base_salary, _extra_class_amount, _adjustment_amount,
    _expense_amount, _gross, _deductions, _net, _calculation_json,
    CASE
      WHEN _old.amount_paid >= _net AND _net > 0 THEN 'paid'
      WHEN _old.amount_paid > 0 THEN 'partially_paid'
      ELSE 'draft'
    END,
    LEAST(_old.amount_paid, _net), _old.amount_paid,
    true, _payout_id, _change_reason,
    _old.invoice_number, _old.recipient_account_snapshot, _old.payment_channel
  ) RETURNING id INTO _new_id;

  UPDATE public.salary_payouts
     SET superseded_by_payout_id = _new_id
   WHERE id = _payout_id;

  RETURN jsonb_build_object(
    'new_payout_id', _new_id,
    'archived_payout_id', _payout_id,
    'prior_paid_amount', _old.amount_paid,
    'new_net_salary', _net,
    'delta_to_settle', _delta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revise_salary_payout(uuid, numeric, numeric, numeric, numeric, numeric, jsonb, text) TO authenticated;
