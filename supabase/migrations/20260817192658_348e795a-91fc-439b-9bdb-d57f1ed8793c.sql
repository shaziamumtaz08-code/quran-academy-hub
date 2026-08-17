CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.student_billing_plans%ROWTYPE;
  m date;
  horizon date;
  backfill_floor date;
  end_month date;
  month_first date;
  month_last date;
  month_key text;
  days_in_month int;
  active_from date;
  active_days int;
  end_date date;
  active_to date;
  prorated numeric;
  existing_inv public.fee_invoices%ROWTYPE;
  student_archived boolean;
BEGIN
  SELECT * INTO p FROM public.student_billing_plans WHERE id = _plan_id;
  IF NOT FOUND OR p.is_active = false OR COALESCE(p.net_recurring_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  IF p.lifecycle_status IN ('closed','suspended','superseded') THEN
    RETURN;
  END IF;

  SELECT archived_at IS NOT NULL INTO student_archived
  FROM public.profiles WHERE id = p.student_id;

  IF COALESCE(student_archived, false) THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'student_archived'),
           status = 'voided',
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND is_archived = false;
    RETURN;
  END IF;

  horizon := (date_trunc('month', now()) + interval '3 months')::date;
  backfill_floor := (date_trunc('month', now()) - interval '36 months')::date;
  m := GREATEST(date_trunc('month', p.effective_from)::date, backfill_floor);

  SELECT CASE
           WHEN a.status = 'active' THEN NULL
           WHEN a.effective_to_date IS NOT NULL
             THEN date_trunc('month', a.effective_to_date)::date
           WHEN a.status IN ('left','completed')
             THEN date_trunc('month', COALESCE(a.status_effective_date, CURRENT_DATE))::date
           ELSE NULL
         END
    INTO end_month
  FROM public.student_teacher_assignments a
  WHERE (p.assignment_id IS NOT NULL AND a.id = p.assignment_id)
     OR (p.assignment_id IS NULL AND a.student_id = p.student_id)
  ORDER BY (a.status = 'active') DESC,
           COALESCE(a.effective_to_date, a.status_effective_date) DESC NULLS FIRST
  LIMIT 1;

  SELECT CASE
           WHEN a.status = 'active' THEN NULL
           WHEN a.effective_to_date IS NOT NULL THEN a.effective_to_date
           WHEN a.status IN ('left','completed') THEN COALESCE(a.status_effective_date, CURRENT_DATE)
           ELSE NULL
         END
    INTO end_date
  FROM public.student_teacher_assignments a
  WHERE (p.assignment_id IS NOT NULL AND a.id = p.assignment_id)
     OR (p.assignment_id IS NULL AND a.student_id = p.student_id)
  ORDER BY (a.status = 'active') DESC,
           COALESCE(a.effective_to_date, a.status_effective_date) DESC NULLS FIRST
  LIMIT 1;

  IF p.billing_close_date IS NOT NULL THEN
    end_month := date_trunc('month', p.billing_close_date)::date;
    end_date := p.billing_close_date;
  END IF;

  IF end_month IS NOT NULL AND end_month < horizon THEN
    horizon := end_month;
  END IF;

  IF end_month IS NOT NULL AND end_month < date_trunc('month', p.effective_from)::date THEN
    UPDATE public.student_billing_plans
       SET is_active = false,
           change_reason = 'system: assignment ended before the plan start month',
           updated_at = now()
     WHERE id = p.id;

    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'assignment_ended'),
           status = 'voided',
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND is_archived = false;
    RETURN;
  END IF;

  WHILE m <= horizon LOOP
    month_first := m;
    month_last := (m + interval '1 month - 1 day')::date;
    month_key := to_char(m, 'YYYY-MM');
    days_in_month := extract(day from month_last)::int;
    active_from := GREATEST(month_first, p.effective_from);
    -- Day-granular end: the exit month is prorated up to the real end date.
    active_to := LEAST(month_last, COALESCE(end_date, month_last));
    active_days := GREATEST(0, (active_to - active_from) + 1);

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
        AND status <> 'voided'
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
          active_from, active_to, prorated, 0, COALESCE(p.currency, 'PKR'), 'pending',
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
               period_to = active_to,
               is_prorated = active_days <> days_in_month,
               prorated_days = active_days,
               prorated_from_date = active_from,
               updated_at = now()
         WHERE id = existing_inv.id;
      END IF;
    END IF;

    m := (m + interval '1 month')::date;
  END LOOP;

  IF end_month IS NOT NULL THEN
    UPDATE public.fee_invoices
       SET voided_at = now(),
           void_reason = 'assignment_ended',
           status = 'voided',
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND is_archived = false
       AND billing_month > to_char(end_month, 'YYYY-MM');
  END IF;

  UPDATE public.fee_invoices
     SET voided_at = now(),
         void_reason = 'before_plan_start',
         status = 'voided',
         updated_at = now()
   WHERE plan_id = p.id
     AND status = 'pending'
     AND COALESCE(amount_paid, 0) = 0
     AND is_archived = false
     AND billing_month < to_char(date_trunc('month', p.effective_from), 'YYYY-MM');
END;
$function$;