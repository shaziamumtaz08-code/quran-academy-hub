
-- Fix 1: auto_generate_plan_invoices — resolve assignment even when plan.assignment_id is null,
-- honor terminated assignments (left/completed/on_hold) as an end-date, and clean up future pending invoices.
CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  a RECORD;
  m date;
  horizon date;
  month_first date;
  month_last date;
  days_in_month int;
  active_from date;
  active_to date;
  active_days int;
  prorated numeric;
  existing_inv RECORD;
  eff_start date;
  eff_end date;
  active_count int;
BEGIN
  SELECT * INTO p FROM public.student_billing_plans WHERE id = _plan_id;
  IF NOT FOUND OR p.is_active = false OR COALESCE(p.net_recurring_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  IF p.assignment_id IS NOT NULL THEN
    SELECT * INTO a FROM public.student_teacher_assignments WHERE id = p.assignment_id;
  ELSE
    -- Prefer an active assignment for this student; otherwise pick the most recent
    -- terminated one to bound the eff_end date so we stop generating future invoices.
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

  -- Determine effective window.
  eff_start := COALESCE(p.effective_from, a.effective_from_date, date_trunc('month', now())::date);
  IF a.id IS NOT NULL AND a.status IS DISTINCT FROM 'active' THEN
    -- Assignment ended (left/completed/on_hold): honor its effective_to_date; fall back to today.
    eff_end := COALESCE(a.effective_to_date, CURRENT_DATE);
  ELSE
    eff_end := NULL;
  END IF;

  -- Clean up unpaid future invoices that fall entirely past eff_end.
  IF eff_end IS NOT NULL THEN
    DELETE FROM public.fee_invoices
      WHERE plan_id = p.id
        AND status = 'pending'
        AND COALESCE(is_archived, false) = false
        AND period_from > eff_end;
  END IF;

  horizon := (date_trunc('month', now()) + interval '3 months')::date;
  m := date_trunc('month', eff_start)::date;

  WHILE m <= horizon LOOP
    month_first := m;
    month_last := (m + interval '1 month' - interval '1 day')::date;
    days_in_month := EXTRACT(day FROM month_last)::int;

    active_from := GREATEST(month_first, eff_start);
    active_to := LEAST(month_last, COALESCE(eff_end, month_last));

    IF active_from <= month_last AND active_to >= month_first AND active_to >= active_from THEN
      active_days := (active_to - active_from) + 1;
      prorated := round((p.net_recurring_fee / days_in_month * active_days)::numeric, 2);

      SELECT * INTO existing_inv FROM public.fee_invoices
        WHERE plan_id = p.id AND billing_month = to_char(m, 'YYYY-MM')
        LIMIT 1;

      IF FOUND THEN
        IF existing_inv.status NOT IN ('paid', 'partially_paid') AND COALESCE(existing_inv.is_archived, false) = false THEN
          UPDATE public.fee_invoices SET
            amount = prorated,
            currency = p.currency,
            period_from = active_from,
            period_to = active_to,
            is_prorated = (active_days < days_in_month),
            prorated_days = active_days,
            prorated_from_date = CASE WHEN active_days < days_in_month THEN active_from ELSE NULL END,
            updated_at = now()
          WHERE id = existing_inv.id
            AND (amount <> prorated
                 OR currency <> p.currency
                 OR period_from IS DISTINCT FROM active_from
                 OR period_to IS DISTINCT FROM active_to);
        END IF;
      ELSE
        INSERT INTO public.fee_invoices (
          plan_id, student_id, amount, currency, billing_month, due_date,
          branch_id, division_id, period_from, period_to,
          is_prorated, prorated_days, prorated_from_date, status
        ) VALUES (
          p.id, p.student_id, prorated, p.currency, to_char(m, 'YYYY-MM'),
          (to_char(m, 'YYYY-MM') || '-10')::date,
          p.branch_id, p.division_id, active_from, active_to,
          (active_days < days_in_month), active_days,
          CASE WHEN active_days < days_in_month THEN active_from ELSE NULL END,
          'pending'
        );
      END IF;
    END IF;

    m := (m + interval '1 month')::date;
  END LOOP;
END;
$$;

-- Fix 2: recompute plan invoices whenever an assignment's status or dates change.
CREATE OR REPLACE FUNCTION public.recompute_plans_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_row RECORD;
BEGIN
  FOR plan_row IN
    SELECT id FROM public.student_billing_plans
      WHERE is_active = true
        AND (assignment_id = NEW.id OR (assignment_id IS NULL AND student_id = NEW.student_id))
  LOOP
    PERFORM public.auto_generate_plan_invoices(plan_row.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_plans_on_assignment_change ON public.student_teacher_assignments;
CREATE TRIGGER trg_recompute_plans_on_assignment_change
  AFTER UPDATE OF status, effective_from_date, effective_to_date
  ON public.student_teacher_assignments
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.effective_from_date IS DISTINCT FROM NEW.effective_from_date
    OR OLD.effective_to_date IS DISTINCT FROM NEW.effective_to_date
  )
  EXECUTE FUNCTION public.recompute_plans_on_assignment_change();

-- Fix 3: retroactively clean up Zayan Jamshed and any other student whose plan
-- currently has ghost future invoices by re-running the generator for all active plans.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.student_billing_plans WHERE is_active = true LOOP
    PERFORM public.auto_generate_plan_invoices(r.id);
  END LOOP;
END $$;
