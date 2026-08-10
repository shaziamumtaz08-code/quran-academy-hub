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
  end_month date;
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

  -- Month-granular assignment end: a student who left in June is billed through June.
  SELECT date_trunc('month', COALESCE(a.effective_to_date, a.status_effective_date))::date
    INTO end_month
  FROM public.student_teacher_assignments a
  WHERE (p.assignment_id IS NOT NULL AND a.id = p.assignment_id)
     OR (p.assignment_id IS NULL AND a.student_id = p.student_id)
  ORDER BY (a.status = 'active') DESC,
           COALESCE(a.effective_to_date, a.status_effective_date) DESC NULLS FIRST
  LIMIT 1;

  IF end_month IS NOT NULL AND end_month < horizon THEN
    horizon := end_month;
  END IF;

  -- Stale plan: its assignment ended before the plan even starts. Deactivate it and
  -- void anything unpaid it produced, so it can never propose bills again.
  IF end_month IS NOT NULL AND end_month < date_trunc('month', p.effective_from)::date THEN
    UPDATE public.student_billing_plans
       SET is_active = false, updated_at = now()
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

  -- Retroactive shrink: void unpaid invoices that now fall outside the plan/assignment window.
  UPDATE public.fee_invoices
     SET voided_at = now(),
         void_reason = 'assignment_ended',
         status = 'voided',
         updated_at = now()
   WHERE plan_id = p.id
     AND status = 'pending'
     AND COALESCE(amount_paid, 0) = 0
     AND is_archived = false
     AND (
       (end_month IS NOT NULL AND billing_month > to_char(end_month, 'YYYY-MM'))
       OR billing_month < to_char(date_trunc('month', p.effective_from), 'YYYY-MM')
     );
END;
$fn$;

-- Data repair: deactivate stale plans whose assignment ended before the plan started
UPDATE public.student_billing_plans p
   SET is_active = false, updated_at = now()
 WHERE p.is_active
   AND p.assignment_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.student_teacher_assignments a
      WHERE a.id = p.assignment_id
        AND COALESCE(a.effective_to_date, a.status_effective_date) IS NOT NULL
        AND date_trunc('month', COALESCE(a.effective_to_date, a.status_effective_date))
            < date_trunc('month', p.effective_from)
   );

-- Data repair: invoices already flagged void must not linger as 'pending'
UPDATE public.fee_invoices i
   SET status = 'voided', updated_at = now()
 WHERE i.status = 'pending'
   AND i.voided_at IS NOT NULL
   AND COALESCE(i.amount_paid, 0) = 0
   AND EXISTS (
     SELECT 1 FROM public.student_billing_plans p
      JOIN public.student_teacher_assignments a ON a.id = p.assignment_id
      WHERE p.id = i.plan_id
        AND COALESCE(a.effective_to_date, a.status_effective_date) IS NOT NULL
   );

-- Data repair: un-void pending invoices whose assignment is in fact still running
UPDATE public.fee_invoices i
   SET voided_at = NULL, void_reason = NULL, status = 'pending', updated_at = now()
 WHERE i.voided_at IS NOT NULL
   AND i.void_reason = 'assignment_ended'
   AND i.status IN ('pending', 'voided')
   AND COALESCE(i.amount_paid, 0) = 0
   AND EXISTS (
     SELECT 1 FROM public.student_billing_plans p
      JOIN public.student_teacher_assignments a ON a.id = p.assignment_id
      WHERE p.id = i.plan_id
        AND p.is_active
        AND a.status = 'active'
        AND a.effective_to_date IS NULL
        AND a.status_effective_date IS NULL
   );