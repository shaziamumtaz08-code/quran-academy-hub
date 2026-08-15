-- =====================================================================
-- ISSUE 2: auto_generate_plan_invoices wrongly derived an "assignment
-- ended" month from status_effective_date on ACTIVE assignments, then
-- voided every invoice beyond it as 'assignment_ended'.
-- =====================================================================
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

  -- FIX: an assignment only "ends" when it is genuinely finished.
  -- status_effective_date on an ACTIVE assignment is the date it BECAME
  -- active, not an end date, and must never terminate billing.
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

  -- An explicit billing close date always wins over the assignment-derived month.
  IF p.billing_close_date IS NOT NULL THEN
    end_month := date_trunc('month', p.billing_close_date)::date;
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

  -- Void months beyond a genuine assignment end only.
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

  -- Void months that fall before the plan even starts (distinct reason).
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

-- =====================================================================
-- ISSUE 1: airtight billing plan audit trail.
-- =====================================================================

-- Canonical snapshot of the financially meaningful columns.
CREATE OR REPLACE FUNCTION public.billing_plan_snapshot(p public.student_billing_plans)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'student_id', p.student_id,
    'assignment_id', p.assignment_id,
    'base_package_id', p.base_package_id,
    'session_duration', p.session_duration,
    'duration_surcharge', p.duration_surcharge,
    'flat_discount', p.flat_discount,
    'net_recurring_fee', p.net_recurring_fee,
    'currency', p.currency,
    'is_active', p.is_active,
    'effective_from', p.effective_from,
    'global_discount_id', p.global_discount_id,
    'manual_discount_reason', p.manual_discount_reason,
    'lifecycle_status', p.lifecycle_status,
    'billing_close_date', p.billing_close_date,
    'close_reason', p.close_reason,
    'superseded_by', p.superseded_by,
    'branch_id', p.branch_id,
    'division_id', p.division_id
  )
$function$;

-- Require a real reason on every human-made change; normalise it onto the row.
CREATE OR REPLACE FUNCTION public.fn_billing_plan_reason_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resolved text;
  normalized text;
BEGIN
  -- Nothing financially meaningful changed (e.g. an updated_at touch).
  IF TG_OP = 'UPDATE'
     AND public.billing_plan_snapshot(OLD) = public.billing_plan_snapshot(NEW) THEN
    RETURN NEW;
  END IF;

  resolved := NULLIF(btrim(COALESCE(NEW.change_reason, '')), '');

  -- A closure carries its own reason.
  IF resolved IS NULL AND TG_OP = 'UPDATE'
     AND NEW.lifecycle_status = 'closed'
     AND OLD.lifecycle_status IS DISTINCT FROM 'closed' THEN
    resolved := NULLIF(btrim(COALESCE(NEW.close_reason, '')), '');
  END IF;

  -- Server-side jobs may declare their reason via a session setting.
  IF resolved IS NULL THEN
    resolved := NULLIF(btrim(COALESCE(current_setting('app.billing_change_reason', true), '')), '');
  END IF;

  normalized := lower(regexp_replace(COALESCE(resolved, ''), '[^a-zA-Z0-9]', '', 'g'));

  IF resolved IS NULL
     OR length(normalized) < 4
     OR normalized IN ('na','none','test','noneed','nil','asdf','xxxx','same','none1') THEN
    IF auth.uid() IS NULL THEN
      -- Automated/definer context: label it rather than blocking the job.
      resolved := 'system: automated billing adjustment';
    ELSE
      RAISE EXCEPTION 'A meaningful reason is required for every billing plan change (min 4 characters, no placeholders such as "." or "no need").'
        USING HINT = 'Set change_reason on the billing plan row before saving.';
    END IF;
  END IF;

  NEW.change_reason := resolved;
  RETURN NEW;
END;
$function$;

-- Log every insert/update, regardless of which code path made it.
CREATE OR REPLACE FUNCTION public.fn_log_billing_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prev jsonb;
  next_vals jsonb;
BEGIN
  next_vals := public.billing_plan_snapshot(NEW);

  IF TG_OP = 'UPDATE' THEN
    prev := public.billing_plan_snapshot(OLD);
    IF prev = next_vals THEN
      RETURN NULL;
    END IF;
  ELSE
    prev := '{}'::jsonb;
  END IF;

  INSERT INTO public.billing_plan_history(
    plan_id, changed_by, effective_from, previous_values, new_values, reason
  ) VALUES (
    NEW.id,
    auth.uid(),
    NEW.effective_from::text,
    prev,
    next_vals,
    COALESCE(NULLIF(btrim(COALESCE(NEW.change_reason, '')), ''), 'system: automated billing adjustment')
  );

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_billing_plan_reason_guard ON public.student_billing_plans;
CREATE TRIGGER trg_billing_plan_reason_guard
BEFORE INSERT OR UPDATE ON public.student_billing_plans
FOR EACH ROW EXECUTE FUNCTION public.fn_billing_plan_reason_guard();

DROP TRIGGER IF EXISTS trg_log_billing_plan_change ON public.student_billing_plans;
CREATE TRIGGER trg_log_billing_plan_change
AFTER INSERT OR UPDATE ON public.student_billing_plans
FOR EACH ROW EXECUTE FUNCTION public.fn_log_billing_plan_change();

-- =====================================================================
-- Invoice void/status consistency (forward-looking only; no existing
-- row is modified by this migration).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_fee_invoice_void_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.voided_at IS NOT NULL AND NEW.status <> 'voided' THEN
    NEW.status := 'voided';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fee_invoice_void_consistency ON public.fee_invoices;
CREATE TRIGGER trg_fee_invoice_void_consistency
BEFORE INSERT OR UPDATE ON public.fee_invoices
FOR EACH ROW EXECUTE FUNCTION public.fn_fee_invoice_void_consistency();