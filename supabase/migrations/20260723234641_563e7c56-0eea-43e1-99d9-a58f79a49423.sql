
-- ============================================================
-- 1. Soft-void columns on financial tables (immutable history)
-- ============================================================
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.salary_payouts
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.at_risk_flags
  ADD COLUMN IF NOT EXISTS period_excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS period_excluded_by_assignment_change uuid;

-- Filtered index so dashboards ignore voided rows fast
CREATE INDEX IF NOT EXISTS idx_fee_invoices_active_not_voided
  ON public.fee_invoices (student_id, billing_month)
  WHERE voided_at IS NULL;

-- ============================================================
-- 2. Window-change audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assignment_window_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  teacher_id uuid,
  field_name text NOT NULL,  -- 'effective_from_date' | 'effective_to_date' | 'status'
  old_value text,
  new_value text,
  is_retroactive boolean NOT NULL DEFAULT false,
  reason text,
  affected_paid_invoices int NOT NULL DEFAULT 0,
  affected_attendance_count int NOT NULL DEFAULT 0,
  affected_paid_payouts int NOT NULL DEFAULT 0,
  affected_unpaid_invoices int NOT NULL DEFAULT 0,
  affected_at_risk_flags int NOT NULL DEFAULT 0,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.assignment_window_change_log TO authenticated;
GRANT ALL ON public.assignment_window_change_log TO service_role;

ALTER TABLE public.assignment_window_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view window change log"
  ON public.assignment_window_change_log FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Block updates & deletes: log is append-only
CREATE OR REPLACE FUNCTION public.fn_window_change_log_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'assignment_window_change_log rows are immutable audit records'; END;
$$;

DROP TRIGGER IF EXISTS trg_window_change_log_no_update ON public.assignment_window_change_log;
CREATE TRIGGER trg_window_change_log_no_update
  BEFORE UPDATE OR DELETE ON public.assignment_window_change_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_window_change_log_immutable();

CREATE INDEX IF NOT EXISTS idx_awcl_assignment ON public.assignment_window_change_log(assignment_id, changed_at DESC);

-- ============================================================
-- 3. Rewrite auto_generate_plan_invoices — soft-void, never delete
-- ============================================================
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

  IF a.id IS NOT NULL AND a.status IN ('on_hold','completed','left') THEN
    -- Soft-void, never delete
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

  IF a.id IS NOT NULL AND a.status IS DISTINCT FROM 'active' THEN
    eff_end := COALESCE(a.effective_to_date, CURRENT_DATE);
  ELSE
    eff_end := NULL;
  END IF;

  -- Soft-void unpaid invoices before the active window
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

  IF eff_end IS NOT NULL THEN
    UPDATE public.fee_invoices
       SET voided_at = COALESCE(voided_at, now()),
           void_reason = COALESCE(void_reason, 'outside_active_window:after_effective_to'),
           updated_at = now()
     WHERE plan_id = p.id
       AND status = 'pending'
       AND COALESCE(amount_paid, 0) = 0
       AND COALESCE(is_archived, false) = false
       AND voided_at IS NULL
       AND period_from > eff_end;
  END IF;

  horizon := (date_trunc('month', now()) + interval '3 months')::date;
  m := date_trunc('month', eff_start)::date;

  WHILE m <= horizon LOOP
    month_first := m;
    month_last := (m + interval '1 month' - interval '1 day')::date;
    month_key := to_char(month_first, 'YYYY-MM');
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

      -- Only consider non-voided existing invoices for the same billing month
      SELECT * INTO existing_inv FROM public.fee_invoices
        WHERE plan_id = p.id AND billing_month = month_key AND voided_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.fee_invoices (
          student_id, assignment_id, plan_id, amount, currency,
          billing_month, period_from, period_to, due_date, status,
          branch_id, division_id, is_prorated, prorated_days, prorated_from_date
        ) VALUES (
          p.student_id, a.id, p.id, prorated, p.currency,
          month_key, month_first, month_last,
          (month_first + interval '9 days')::date, 'pending',
          p.branch_id, p.division_id,
          active_days < days_in_month, active_days,
          CASE WHEN active_days < days_in_month THEN active_from ELSE NULL END
        );
      ELSIF existing_inv.status = 'pending'
            AND COALESCE(existing_inv.amount_paid, 0) = 0
            AND COALESCE(existing_inv.is_archived, false) = false THEN
        UPDATE public.fee_invoices
          SET amount = prorated,
              assignment_id = COALESCE(existing_inv.assignment_id, a.id),
              period_from = month_first,
              period_to = month_last,
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

-- ============================================================
-- 4. Window-change trigger: retroactive guard + audit + notify
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_log_assignment_window_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _paid_inv int := 0;
  _att int := 0;
  _paid_pay int := 0;
  _unpaid_inv int := 0;
  _flags int := 0;
  _retro boolean := false;
  _win_from date;
  _win_to date;
  _log_id uuid;
  _field text;
  _old text;
  _new text;
  _changed boolean := false;
BEGIN
  -- Only run when a window-shaping field changes
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF NEW.effective_from_date IS DISTINCT FROM OLD.effective_from_date THEN
    _field := 'effective_from_date';
    _old := OLD.effective_from_date::text;
    _new := NEW.effective_from_date::text;
    _changed := true;
  ELSIF NEW.effective_to_date IS DISTINCT FROM OLD.effective_to_date THEN
    _field := 'effective_to_date';
    _old := OLD.effective_to_date::text;
    _new := NEW.effective_to_date::text;
    _changed := true;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('on_hold','completed','left')
        AND OLD.status = 'active' THEN
    _field := 'status';
    _old := OLD.status::text;
    _new := NEW.status::text;
    _changed := true;
  END IF;

  IF NOT _changed THEN RETURN NEW; END IF;

  -- Compute the *effective* new window
  _win_from := NEW.effective_from_date;
  _win_to := COALESCE(
    NEW.effective_to_date,
    CASE WHEN NEW.status IN ('completed','left','on_hold') THEN CURRENT_DATE ELSE NULL END
  );

  -- Count records now OUTSIDE the new window, scoped to THIS assignment only
  SELECT COUNT(*) INTO _paid_inv
    FROM public.fee_invoices
   WHERE assignment_id = NEW.id
     AND voided_at IS NULL
     AND (status = 'paid' OR COALESCE(amount_paid,0) > 0)
     AND (
       (_win_from IS NOT NULL AND period_to < _win_from) OR
       (_win_to IS NOT NULL AND period_from > _win_to)
     );

  SELECT COUNT(*) INTO _unpaid_inv
    FROM public.fee_invoices
   WHERE assignment_id = NEW.id
     AND voided_at IS NULL
     AND status = 'pending'
     AND COALESCE(amount_paid,0) = 0
     AND (
       (_win_from IS NOT NULL AND period_to < _win_from) OR
       (_win_to IS NOT NULL AND period_from > _win_to)
     );

  SELECT COUNT(*) INTO _att
    FROM public.attendance
   WHERE student_id = NEW.student_id
     AND teacher_id = NEW.teacher_id
     AND (
       (_win_from IS NOT NULL AND class_date < _win_from) OR
       (_win_to IS NOT NULL AND class_date > _win_to)
     );

  SELECT COUNT(*) INTO _paid_pay
    FROM public.salary_payouts
   WHERE teacher_id = NEW.teacher_id
     AND voided_at IS NULL
     AND status = 'paid'
     AND (
       (_win_from IS NOT NULL AND pay_period_end < _win_from) OR
       (_win_to IS NOT NULL AND pay_period_start > _win_to)
     );

  SELECT COUNT(*) INTO _flags
    FROM public.at_risk_flags
   WHERE student_id = NEW.student_id;

  _retro := (_paid_inv > 0 OR _att > 0 OR _paid_pay > 0);

  -- Retroactive changes require a reason
  IF _retro AND (COALESCE(NULLIF(trim(NEW.status_change_reason), ''), NULL) IS NULL) THEN
    RAISE EXCEPTION 'Retroactive window change requires a reason. This change would exclude % paid invoice(s), % attendance record(s), and % paid payout(s) from accountability. Please set status_change_reason.',
      _paid_inv, _att, _paid_pay;
  END IF;

  -- Log the change
  INSERT INTO public.assignment_window_change_log(
    assignment_id, student_id, teacher_id, field_name, old_value, new_value,
    is_retroactive, reason,
    affected_paid_invoices, affected_attendance_count, affected_paid_payouts,
    affected_unpaid_invoices, affected_at_risk_flags, changed_by
  ) VALUES (
    NEW.id, NEW.student_id, NEW.teacher_id, _field, _old, _new,
    _retro, NEW.status_change_reason,
    _paid_inv, _att, _paid_pay, _unpaid_inv, _flags, _uid
  ) RETURNING id INTO _log_id;

  -- Tag at-risk flags outside window (kept, not deleted)
  UPDATE public.at_risk_flags
     SET period_excluded_at = now(),
         period_excluded_by_assignment_change = _log_id
   WHERE student_id = NEW.student_id
     AND period_excluded_at IS NULL
     AND (
       (_win_from IS NOT NULL AND detected_at::date < _win_from) OR
       (_win_to IS NOT NULL AND detected_at::date > _win_to)
     );

  -- Notify admins on ANY exclusion (no threshold)
  IF _paid_inv + _att + _paid_pay + _unpaid_inv > 0 THEN
    INSERT INTO public.notification_queue(
      recipient_role, channel, template_key, payload, status
    ) VALUES (
      'admin', 'in_app', 'assignment_window_changed',
      jsonb_build_object(
        'assignment_id', NEW.id,
        'student_id', NEW.student_id,
        'teacher_id', NEW.teacher_id,
        'log_id', _log_id,
        'field', _field,
        'old', _old,
        'new', _new,
        'paid_invoices_excluded', _paid_inv,
        'unpaid_invoices_voided', _unpaid_inv,
        'attendance_excluded', _att,
        'paid_payouts_excluded', _paid_pay,
        'retroactive', _retro,
        'reason', NEW.status_change_reason
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_assignment_window_change ON public.student_teacher_assignments;
CREATE TRIGGER trg_log_assignment_window_change
  BEFORE UPDATE ON public.student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_assignment_window_change();

-- ============================================================
-- 5. Enforce windows across all active plans (uses new soft-void logic)
-- ============================================================
SELECT public.enforce_assignment_windows_all();
