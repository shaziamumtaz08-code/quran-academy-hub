CREATE OR REPLACE FUNCTION public.revise_salary_payout(
  _payout_id uuid,
  _base_salary numeric,
  _extra_class_amount numeric,
  _adjustment_amount numeric,
  _expense_amount numeric,
  _deductions numeric,
  _calculation_json jsonb,
  _change_reason text,
  _settlement_action text DEFAULT 'settle_separately',
  _settlement_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old public.salary_payouts%ROWTYPE;
  _new_id uuid;
  _gross numeric;
  _net numeric;
  _delta numeric;
  _new_status text;
  _auto_note text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _settlement_action NOT IN ('settle_separately', 'carry_forward', 'accept_no_action') THEN
    RAISE EXCEPTION 'invalid settlement action';
  END IF;

  SELECT * INTO _old FROM public.salary_payouts WHERE id = _payout_id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'payout not found'; END IF;
  IF _old.is_archived THEN RAISE EXCEPTION 'payout already archived'; END IF;

  _gross := COALESCE(_base_salary,0) + COALESCE(_extra_class_amount,0) + COALESCE(_adjustment_amount,0) + COALESCE(_expense_amount,0);
  _net := _gross - COALESCE(_deductions,0);
  _delta := _net - COALESCE(_old.amount_paid, 0);
  _new_status := CASE
    WHEN _settlement_action = 'accept_no_action' THEN 'paid'
    WHEN _old.amount_paid >= _net AND _net > 0 THEN 'paid'
    WHEN _old.amount_paid > 0 THEN 'partially_paid'
    ELSE 'draft'
  END;

  -- Auto-generate a settlement note if none was provided so the audit log is still populated.
  _auto_note := COALESCE(NULLIF(btrim(COALESCE(_settlement_note, '')), ''),
    CASE _settlement_action
      WHEN 'accept_no_action' THEN COALESCE(_change_reason, 'Revision accepted') || ' — rounded payment accepted; no further action'
      WHEN 'carry_forward' THEN COALESCE(_change_reason, 'Revision carried forward') || ' — difference carried to next salary'
      WHEN 'settle_separately' THEN COALESCE(_change_reason, 'Revision settled separately') || ' — difference to be settled separately'
      ELSE COALESCE(_change_reason, 'Salary revised')
    END
  );

  UPDATE public.salary_payouts
     SET is_archived = true,
         archived_at = now(),
         archive_reason = COALESCE(_change_reason, 'Salary revised')
   WHERE id = _payout_id;

  INSERT INTO public.salary_payouts(
    teacher_id, salary_month, base_salary, extra_class_amount, adjustment_amount,
    expense_amount, gross_salary, deductions, net_salary, calculation_json,
    status, amount_paid, prior_paid_amount,
    is_revised, revises_payout_id, change_reason,
    invoice_number, recipient_account_snapshot, payment_channel,
    receipt_url, receipt_urls, paid_at, paid_by, payment_method, payment_reference,
    revision_delta, settlement_action, settlement_note
  ) VALUES (
    _old.teacher_id, _old.salary_month, _base_salary, _extra_class_amount, _adjustment_amount,
    _expense_amount, _gross, _deductions, _net, _calculation_json,
    _new_status, _old.amount_paid, _old.amount_paid,
    true, _payout_id, _change_reason,
    _old.invoice_number, _old.recipient_account_snapshot, _old.payment_channel,
    _old.receipt_url, _old.receipt_urls, _old.paid_at, _old.paid_by, _old.payment_method, _old.payment_reference,
    _delta, _settlement_action, _auto_note
  ) RETURNING id INTO _new_id;

  UPDATE public.salary_payouts
     SET superseded_by_payout_id = _new_id
   WHERE id = _payout_id;

  RETURN jsonb_build_object(
    'new_payout_id', _new_id,
    'archived_payout_id', _payout_id,
    'prior_paid_amount', _old.amount_paid,
    'new_net_salary', _net,
    'delta_to_settle', _delta,
    'settlement_action', _settlement_action
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.revise_salary_payout(uuid, numeric, numeric, numeric, numeric, numeric, jsonb, text, text, text) TO authenticated, service_role;