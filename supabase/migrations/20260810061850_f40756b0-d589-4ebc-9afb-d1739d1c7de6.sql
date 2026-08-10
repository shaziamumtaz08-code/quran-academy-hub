-- 1. Salary sheet staleness markers
ALTER TABLE public.salary_payouts
  ADD COLUMN IF NOT EXISTS revision_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_reason text;

-- 2. Invoice generation: honour real plan start + assignment end month
CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND is_archived = false
       AND voided_at IS NULL;
    RETURN;
  END IF;

  horizon := (date_trunc('month', now()) + interval '3 months')::date;
  -- Back-date safe: start from the plan's own start month (bounded to 3 years back),
  -- NOT a rolling 6-month window, so retroactive plans still produce full history.
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

  -- Retroactive shrink: void unpaid invoices that now fall outside the plan/assignment window.
  UPDATE public.fee_invoices
     SET voided_at = now(),
         void_reason = 'assignment_ended',
         updated_at = now()
   WHERE plan_id = p.id
     AND status = 'pending'
     AND COALESCE(amount_paid, 0) = 0
     AND is_archived = false
     AND voided_at IS NULL
     AND (
       (end_month IS NOT NULL AND billing_month > to_char(end_month, 'YYYY-MM'))
       OR billing_month < to_char(date_trunc('month', p.effective_from), 'YYYY-MM')
     );
END;
$$;

-- 3. Mark saved salary sheets as needing revision when their source data is back-dated
CREATE OR REPLACE FUNCTION public.mark_salary_payouts_for_revision(
  _teacher_id uuid, _from_month date, _to_month date, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _teacher_id IS NULL OR _from_month IS NULL THEN RETURN; END IF;
  UPDATE public.salary_payouts
     SET revision_required_at = now(),
         revision_reason = COALESCE(_reason, 'source data changed retroactively'),
         updated_at = now()
   WHERE teacher_id = _teacher_id
     AND is_archived = false
     AND voided_at IS NULL
     AND status <> 'paid'
     AND salary_month >= to_char(date_trunc('month', _from_month), 'YYYY-MM')
     AND salary_month <= to_char(date_trunc('month', COALESCE(_to_month, _from_month)), 'YYYY-MM');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_flag_payouts_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win_start date;
  win_end date;
BEGIN
  IF NEW.effective_from_date IS DISTINCT FROM OLD.effective_from_date
     OR NEW.effective_to_date IS DISTINCT FROM OLD.effective_to_date
     OR NEW.status_effective_date IS DISTINCT FROM OLD.status_effective_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.payout_amount IS DISTINCT FROM OLD.payout_amount THEN
    win_start := LEAST(
      COALESCE(OLD.effective_from_date, NEW.effective_from_date, CURRENT_DATE),
      COALESCE(NEW.effective_from_date, OLD.effective_from_date, CURRENT_DATE)
    );
    win_end := GREATEST(
      COALESCE(OLD.effective_to_date, OLD.status_effective_date, CURRENT_DATE),
      COALESCE(NEW.effective_to_date, NEW.status_effective_date, CURRENT_DATE)
    );
    PERFORM public.mark_salary_payouts_for_revision(
      NEW.teacher_id, win_start, win_end, 'assignment window or payout changed');
    IF OLD.teacher_id IS DISTINCT FROM NEW.teacher_id THEN
      PERFORM public.mark_salary_payouts_for_revision(
        OLD.teacher_id, win_start, win_end, 'assignment reassigned to another teacher');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_payouts_on_assignment_change ON public.student_teacher_assignments;
CREATE TRIGGER trg_flag_payouts_on_assignment_change
AFTER UPDATE ON public.student_teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_flag_payouts_on_assignment_change();

CREATE OR REPLACE FUNCTION public.fn_flag_payouts_on_leave_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.mark_salary_payouts_for_revision(
    r.teacher_id, r.start_date, r.end_date, 'teacher leave record changed retroactively');
  IF TG_OP = 'UPDATE' AND (OLD.start_date IS DISTINCT FROM NEW.start_date
      OR OLD.end_date IS DISTINCT FROM NEW.end_date) THEN
    PERFORM public.mark_salary_payouts_for_revision(
      OLD.teacher_id, OLD.start_date, OLD.end_date, 'teacher leave dates changed retroactively');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_payouts_on_leave_change ON public.leave_events;
CREATE TRIGGER trg_flag_payouts_on_leave_change
AFTER INSERT OR UPDATE OR DELETE ON public.leave_events
FOR EACH ROW EXECUTE FUNCTION public.fn_flag_payouts_on_leave_change();

-- 4. Clean up existing ghost invoices billed after the assignment ended
UPDATE public.fee_invoices i
   SET voided_at = now(),
       void_reason = 'assignment_ended',
       updated_at = now()
  FROM public.student_billing_plans p,
       public.student_teacher_assignments a
 WHERE i.plan_id = p.id
   AND a.student_id = p.student_id
   AND a.status IN ('left','completed')
   AND i.status = 'pending'
   AND COALESCE(i.amount_paid,0) = 0
   AND i.voided_at IS NULL
   AND i.is_archived = false
   AND i.billing_month > to_char(COALESCE(a.effective_to_date, a.status_effective_date), 'YYYY-MM');