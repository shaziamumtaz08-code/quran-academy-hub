
CREATE OR REPLACE FUNCTION public.auto_generate_plan_invoices(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- HARD SUSPENSION: on_hold / completed / left → delete all unpaid pendings, no new invoices.
  IF a.id IS NOT NULL AND a.status IN ('on_hold','completed','left') THEN
    DELETE FROM public.fee_invoices
      WHERE plan_id = p.id
        AND status = 'pending'
        AND COALESCE(amount_paid, 0) = 0
        AND COALESCE(is_archived, false) = false;
    RETURN;
  END IF;

  eff_start := COALESCE(p.effective_from, a.effective_from_date, date_trunc('month', now())::date);
  IF a.id IS NOT NULL AND a.status IS DISTINCT FROM 'active' THEN
    eff_end := COALESCE(a.effective_to_date, CURRENT_DATE);
  ELSE
    eff_end := NULL;
  END IF;

  DELETE FROM public.fee_invoices
    WHERE plan_id = p.id
      AND status = 'pending'
      AND COALESCE(is_archived, false) = false
      AND period_to < eff_start;

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
    active_days := GREATEST(0, (active_to - active_from) + 1);

    IF active_days > 0 THEN
      IF active_days >= days_in_month THEN
        prorated := ROUND(p.net_recurring_fee::numeric, 2);
      ELSE
        prorated := ROUND((p.net_recurring_fee::numeric / days_in_month) * active_days, 2);
      END IF;

      SELECT * INTO existing_inv FROM public.fee_invoices
        WHERE plan_id = p.id AND period_from = month_first
        LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.fee_invoices (
          student_id, assignment_id, plan_id, amount, currency,
          billing_month, period_from, period_to, due_date, status,
          branch_id, division_id, is_prorated, prorated_days, prorated_from_date
        ) VALUES (
          p.student_id, a.id, p.id, prorated, p.currency,
          month_first, month_first, month_last,
          (month_first + interval '9 days')::date, 'pending',
          p.branch_id, p.division_id,
          active_days < days_in_month, active_days,
          CASE WHEN active_days < days_in_month THEN active_from ELSE NULL END
        );
      ELSIF existing_inv.status = 'pending' AND COALESCE(existing_inv.amount_paid, 0) = 0
            AND COALESCE(existing_inv.is_archived, false) = false THEN
        UPDATE public.fee_invoices
          SET amount = prorated,
              is_prorated = active_days < days_in_month,
              prorated_days = active_days,
              prorated_from_date = CASE WHEN active_days < days_in_month THEN active_from ELSE NULL END,
              updated_at = now()
          WHERE id = existing_inv.id;
      END IF;
    END IF;

    m := (m + interval '1 month')::date;
  END LOOP;
END;
$function$;

-- Immediate cleanup: purge unpaid pending invoices for all currently on_hold / completed / left assignments
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT sbp.id AS plan_id
    FROM public.student_billing_plans sbp
    JOIN public.student_teacher_assignments a
      ON (sbp.assignment_id = a.id
          OR (sbp.assignment_id IS NULL AND a.student_id = sbp.student_id))
    WHERE a.status IN ('on_hold','completed','left')
  LOOP
    PERFORM public.auto_generate_plan_invoices(r.plan_id);
  END LOOP;
END $$;
