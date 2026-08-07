ALTER TABLE public.fee_invoices
  DROP CONSTRAINT IF EXISTS fee_invoices_assignment_id_billing_month_key;

CREATE INDEX IF NOT EXISTS idx_fee_invoices_assignment_month
  ON public.fee_invoices(assignment_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_active_plan_month
  ON public.fee_invoices(plan_id, billing_month)
  WHERE plan_id IS NOT NULL AND is_archived = false AND voided_at IS NULL;

CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  p public.student_billing_plans%ROWTYPE;
  m date;
  horizon date;
  backfill_floor date;
  month_first date;
  month_last date;
  month_key text;
  days_in_month int;
  active_from date;
  active_days int;
  prorated numeric;
  existing_inv public.fee_invoices%ROWTYPE;
  student_archived boolean;
BEGIN
  SELECT * INTO p FROM public.student_billing_plans WHERE id = _plan_id;
  IF NOT FOUND OR p.is_active = false OR COALESCE(p.net_recurring_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT archived_at IS NOT NULL INTO student_archived
  FROM public.profiles WHERE id = p.student_id;

  IF COALESCE(student_archived, false) THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'student_archived'),
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND is_archived = false
       AND voided_at IS NULL;
    RETURN;
  END IF;

  horizon := (date_trunc('month', now()) + interval '3 months')::date;
  backfill_floor := (date_trunc('month', now()) - interval '6 months')::date;
  m := GREATEST(date_trunc('month', p.effective_from)::date, backfill_floor);

  WHILE m <= horizon LOOP
    month_first := m;
    month_last := (m + interval '1 month - 1 day')::date;
    month_key := to_char(m, 'YYYY-MM');
    days_in_month := extract(day from month_last)::int;
    active_from := GREATEST(month_first, p.effective_from);
    active_days := GREATEST(0, (month_last - active_from) + 1);

    IF active_days > 0 THEN
      prorated := CASE WHEN active_days = days_in_month
        THEN p.net_recurring_fee
        ELSE round((p.net_recurring_fee::numeric / days_in_month) * active_days, 2)
      END;

      SELECT * INTO existing_inv
      FROM public.fee_invoices
      WHERE student_id = p.student_id
        AND billing_month = month_key
        AND is_archived = false
        AND voided_at IS NULL
      ORDER BY (plan_id = p.id) DESC, created_at DESC
      LIMIT 1;

      IF existing_inv.id IS NULL THEN
        INSERT INTO public.fee_invoices(
          student_id, assignment_id, plan_id, billing_month,
          period_from, period_to, amount, amount_paid, currency, status,
          due_date, branch_id, division_id, is_prorated,
          prorated_days, prorated_from_date
        ) VALUES (
          p.student_id, NULL, p.id, month_key,
          active_from, month_last, prorated, 0, COALESCE(p.currency, 'PKR'), 'pending',
          month_first + 9, p.branch_id, p.division_id,
          active_days <> days_in_month, active_days, active_from
        );
      ELSIF existing_inv.plan_id = p.id
        AND existing_inv.status = 'pending'
        AND COALESCE(existing_inv.amount_paid, 0) = 0 THEN
        UPDATE public.fee_invoices
           SET assignment_id = NULL,
               amount = prorated,
               currency = COALESCE(p.currency, currency),
               period_from = active_from,
               period_to = month_last,
               is_prorated = active_days <> days_in_month,
               prorated_days = active_days,
               prorated_from_date = active_from,
               updated_at = now()
         WHERE id = existing_inv.id;
      END IF;
    END IF;

    m := (m + interval '1 month')::date;
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.revise_billing_plan(
  _student_id uuid,
  _base_package_id uuid,
  _session_duration int,
  _flat_discount numeric,
  _global_discount_id uuid,
  _net_recurring_fee numeric,
  _currency text,
  _effective_from date,
  _change_reason text DEFAULT NULL,
  _assignment_id uuid DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _division_id uuid DEFAULT NULL,
  _duration_surcharge numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  old_plan public.student_billing_plans%ROWTYPE;
  new_plan_id uuid;
  inv public.fee_invoices%ROWTYPE;
  new_invoice_id uuid;
  affected_month text := to_char(_effective_from, 'YYYY-MM');
  refreshed int := 0;
  reason_text text := COALESCE(NULLIF(trim(_change_reason), ''), 'Billing plan updated');
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _effective_from IS NULL OR COALESCE(_net_recurring_fee, 0) <= 0 THEN
    RAISE EXCEPTION 'Effective date and a positive recurring fee are required';
  END IF;

  SELECT * INTO old_plan
  FROM public.student_billing_plans
  WHERE student_id = _student_id
    AND superseded_by IS NULL
    AND is_active = true
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.student_billing_plans(
    student_id, base_package_id, assignment_id, session_duration,
    duration_surcharge, flat_discount, net_recurring_fee, currency,
    is_active, branch_id, division_id, global_discount_id,
    effective_from, change_reason
  ) VALUES (
    _student_id, _base_package_id, NULL, _session_duration,
    _duration_surcharge, _flat_discount, _net_recurring_fee, _currency,
    false, _branch_id, _division_id, _global_discount_id,
    _effective_from, reason_text
  ) RETURNING id INTO new_plan_id;

  IF old_plan.id IS NOT NULL THEN
    UPDATE public.student_billing_plans
       SET superseded_by = new_plan_id,
           superseded_at = now(),
           is_active = false,
           change_reason = reason_text
     WHERE id = old_plan.id;

    INSERT INTO public.billing_plan_history(
      plan_id, changed_by, effective_from, previous_values, new_values, reason
    ) VALUES (
      new_plan_id, auth.uid(), _effective_from::text,
      to_jsonb(old_plan),
      jsonb_build_object(
        'id', new_plan_id,
        'student_id', _student_id,
        'base_package_id', _base_package_id,
        'session_duration', _session_duration,
        'duration_surcharge', _duration_surcharge,
        'flat_discount', _flat_discount,
        'global_discount_id', _global_discount_id,
        'net_recurring_fee', _net_recurring_fee,
        'currency', _currency,
        'effective_from', _effective_from,
        'assignment_id', NULL
      ),
      reason_text
    );
  END IF;

  FOR inv IN
    SELECT * FROM public.fee_invoices
    WHERE student_id = _student_id
      AND billing_month >= affected_month
      AND is_archived = false
      AND voided_at IS NULL
      AND status <> 'paid'
      AND COALESCE(amount_paid, 0) = 0
    ORDER BY billing_month, created_at
    FOR UPDATE
  LOOP
    UPDATE public.fee_invoices
       SET is_archived = true,
           archived_at = now(),
           archive_reason = reason_text,
           updated_at = now()
     WHERE id = inv.id;
    refreshed := refreshed + 1;
  END LOOP;

  UPDATE public.student_billing_plans
     SET is_active = true
   WHERE id = new_plan_id;

  PERFORM public.auto_generate_plan_invoices(new_plan_id);

  FOR inv IN
    SELECT * FROM public.fee_invoices
    WHERE student_id = _student_id
      AND plan_id = new_plan_id
      AND billing_month >= affected_month
      AND is_archived = false
      AND voided_at IS NULL
  LOOP
    SELECT id INTO new_invoice_id
    FROM public.fee_invoices
    WHERE student_id = _student_id
      AND billing_month = inv.billing_month
      AND is_archived = true
      AND archived_at IS NOT NULL
    ORDER BY archived_at DESC
    LIMIT 1;

    IF new_invoice_id IS NOT NULL THEN
      UPDATE public.fee_invoices
         SET is_revised = true,
             revises_invoice_id = new_invoice_id
       WHERE id = inv.id;
      UPDATE public.fee_invoices
         SET superseded_by_invoice_id = inv.id
       WHERE id = new_invoice_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'new_plan_id', new_plan_id,
    'superseded_plan_id', old_plan.id,
    'affected_month', affected_month,
    'future_invoices_revised', refreshed
  );
END;
$fn$;