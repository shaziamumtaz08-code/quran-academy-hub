CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  p RECORD;
  a RECORD;
  m date;
  horizon date;
  backfill_floor date;
  month_first date;
  month_last date;
  month_key text;
  days_in_month int;
  active_from date;
  active_to date;
  active_days int;
  prorated numeric;
  existing_inv RECORD;
  eff_start date;
  eff_end date;
  active_count int;
  student_archived boolean;
BEGIN
  SELECT * INTO p FROM public.student_billing_plans WHERE id = _plan_id;
  IF NOT FOUND OR p.is_active = false OR COALESCE(p.net_recurring_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT (archived_at IS NOT NULL) INTO student_archived
    FROM public.profiles WHERE id = p.student_id;
  IF COALESCE(student_archived, false) THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'student_archived'),
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND COALESCE(is_archived, false) = false
       AND voided_at IS NULL;
    RETURN;
  END IF;

  IF p.assignment_id IS NOT NULL THEN
    SELECT * INTO a FROM public.student_teacher_assignments WHERE id = p.assignment_id;
  ELSE
    SELECT COUNT(*) INTO active_count FROM public.student_teacher_assignments
      WHERE student_id = p.student_id AND status = 'active';
    IF active_count > 0 THEN
      SELECT * INTO a FROM public.student_teacher_assignments
        WHERE student_id = p.student_id AND status = 'active'
        ORDER BY effective_from_date NULLS LAST LIMIT 1;
    ELSE
      SELECT * INTO a FROM public.student_teacher_assignments
        WHERE student_id = p.student_id
        ORDER BY COALESCE(effective_to_date, effective_from_date, created_at::date) DESC NULLS LAST
        LIMIT 1;
    END IF;
  END IF;

  IF a.id IS NULL THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'no_assignment_linked'),
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND COALESCE(is_archived, false) = false
       AND voided_at IS NULL;
    RETURN;
  END IF;

  IF a.status IN ('on_hold','completed','left') THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'outside_active_window:assignment_' || a.status),
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND COALESCE(is_archived, false) = false
       AND voided_at IS NULL;

    IF a.effective_to_date IS NOT NULL THEN
      UPDATE public.fee_invoices
         SET voided_at = COALESCE(voided_at, now()),
             void_reason = COALESCE(void_reason, 'outside_active_window:after_effective_to'),
             updated_at = now()
       WHERE plan_id = p.id
         AND status = 'pending'
         AND COALESCE(amount_paid, 0) = 0
         AND COALESCE(is_archived, false) = false
         AND voided_at IS NULL
         AND period_from > a.effective_to_date;
    END IF;
    RETURN;
  END IF;

  eff_start := GREATEST(
    COALESCE(p.effective_from, DATE '1900-01-01'),
    COALESCE(a.effective_from_date, DATE '1900-01-01')
  );
  IF eff_start = DATE '1900-01-01' THEN
    eff_start := date_trunc('month', now())::date;
  END IF;

  IF a.status IS DISTINCT FROM 'active' THEN
    eff_end := COALESCE(a.effective_to_date, CURRENT_DATE);
  ELSE
    eff_end := NULL;
  END IF;

  UPDATE public.fee_invoices
     SET voided_at = COALESCE(voided_at, now()),
         void_reason = COALESCE(void_reason, 'outside_active_window:before_effective_from'),
         updated_at = now()
   WHERE plan_id = p.id
     AND status = 'pending'
     AND COALESCE(amount_paid, 0) = 0
     AND COALESCE(is_archived, false) = false
     AND voided_at IS NULL
     AND period_to < eff_start;

  horizon := (date_trunc('month', now()) + INTERVAL '3 months')::date;
  backfill_floor := (date_trunc('month', now()) - INTERVAL '6 months')::date;
  m := GREATEST(date_trunc('month', eff_start)::date, backfill_floor);

  WHILE m <= horizon LOOP
    month_first := m;
    month_last := (m + INTERVAL '1 month' - INTERVAL '1 day')::date;
    IF eff_end IS NOT NULL AND month_first > eff_end THEN
      EXIT;
    END IF;
    month_key := to_char(m, 'YYYY-MM');
    days_in_month := EXTRACT(day FROM month_last)::int;

    active_from := GREATEST(month_first, eff_start);
    active_to := LEAST(month_last, COALESCE(eff_end, month_last));
    active_days := GREATEST(0, (active_to - active_from) + 1);

    IF active_days = 0 THEN
      m := (m + INTERVAL '1 month')::date;
      CONTINUE;
    END IF;

    IF active_days = days_in_month THEN
      prorated := p.net_recurring_fee;
    ELSE
      prorated := ROUND((p.net_recurring_fee::numeric / days_in_month) * active_days, 2);
    END IF;

    -- Look up by the same key as the unique constraint (assignment_id, billing_month),
    -- preferring a row already owned by this plan.
    SELECT * INTO existing_inv FROM public.fee_invoices
      WHERE billing_month = month_key
        AND (assignment_id = a.id OR plan_id = p.id)
      ORDER BY (plan_id = p.id) DESC, created_at DESC
      LIMIT 1;

    IF existing_inv.id IS NULL THEN
      INSERT INTO public.fee_invoices (
        student_id, assignment_id, plan_id, billing_month, period_from, period_to,
        amount, amount_paid, currency, status, due_date,
        branch_id, division_id, is_prorated, prorated_days, prorated_from_date
      ) VALUES (
        p.student_id, a.id, p.id, month_key, active_from, active_to,
        prorated, 0, COALESCE(p.currency,'PKR'), 'pending',
        (month_first + INTERVAL '9 days')::date,
        p.branch_id, p.division_id,
        active_days <> days_in_month, active_days, active_from
      );
    ELSIF existing_inv.status = 'pending'
       AND COALESCE(existing_inv.amount_paid,0) = 0
       AND COALESCE(existing_inv.is_archived, false) = false THEN
      -- Reuse (and if it was voided by an older plan, revive) the row for this month.
      UPDATE public.fee_invoices
         SET plan_id = p.id,
             assignment_id = a.id,
             amount = prorated,
             currency = COALESCE(p.currency, currency),
             period_from = active_from,
             period_to = active_to,
             is_prorated = (active_days <> days_in_month),
             prorated_days = active_days,
             prorated_from_date = active_from,
             voided_at = NULL,
             void_reason = NULL,
             updated_at = now()
       WHERE id = existing_inv.id;
    END IF;

    m := (m + INTERVAL '1 month')::date;
  END LOOP;
END;
$fn$;