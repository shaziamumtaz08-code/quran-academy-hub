
-- ============================================================
-- Phase A: Billing plan history + archived/revised invoices
-- Extend-only; no rows ever deleted or rewritten in place.
-- ============================================================

-- A1. student_billing_plans: history columns
ALTER TABLE public.student_billing_plans
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.student_billing_plans(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS change_reason text;

CREATE INDEX IF NOT EXISTS idx_sbp_student_effective
  ON public.student_billing_plans(student_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_sbp_active_not_superseded
  ON public.student_billing_plans(student_id) WHERE superseded_by IS NULL AND is_active = true;

-- Backfill effective_from from created_at where possible; log NULL created_at for review
CREATE TABLE IF NOT EXISTS public.billing_plan_backfill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  note text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plan_backfill_log TO authenticated;
GRANT ALL ON public.billing_plan_backfill_log TO service_role;
ALTER TABLE public.billing_plan_backfill_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read backfill log" ON public.billing_plan_backfill_log
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

INSERT INTO public.billing_plan_backfill_log(plan_id, note)
SELECT id, 'created_at was NULL — effective_from defaulted to current_date, manual review required'
FROM public.student_billing_plans WHERE created_at IS NULL;

UPDATE public.student_billing_plans
SET effective_from = created_at::date
WHERE created_at IS NOT NULL AND effective_from = current_date;

-- A2. fee_invoices: archival + proration + revision link
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_invoice_id uuid REFERENCES public.fee_invoices(id),
  ADD COLUMN IF NOT EXISTS revises_invoice_id uuid REFERENCES public.fee_invoices(id),
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS is_prorated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prorated_days int,
  ADD COLUMN IF NOT EXISTS prorated_from_date date,
  ADD COLUMN IF NOT EXISTS is_revised boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS line_items jsonb;

CREATE INDEX IF NOT EXISTS idx_fee_invoices_not_archived
  ON public.fee_invoices(student_id, billing_month) WHERE is_archived = false;

-- A3. Helper: which plan row applies to a given billing month
CREATE OR REPLACE FUNCTION public.get_plan_for_month(_student_id uuid, _billing_month text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.student_billing_plans
   WHERE student_id = _student_id
     AND effective_from <= (to_date(_billing_month || '-01','YYYY-MM-DD') + interval '1 month - 1 day')::date
   ORDER BY effective_from DESC, created_at DESC
   LIMIT 1
$$;

-- A4. Proration helper
CREATE OR REPLACE FUNCTION public.calc_prorated_amount(_monthly numeric, _from_date date)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  _days_in_month int := EXTRACT(DAY FROM (date_trunc('month', _from_date) + interval '1 month - 1 day'));
  _remaining int := _days_in_month - EXTRACT(DAY FROM _from_date)::int + 1;
BEGIN
  IF _monthly IS NULL OR _monthly = 0 THEN RETURN 0; END IF;
  RETURN round(_monthly / _days_in_month * _remaining, 2);
END;
$$;

-- A5. Split-month line items (old rate Δ1..Δfrom-1, new rate Δfrom..end)
CREATE OR REPLACE FUNCTION public.build_split_month_lines(
  _old_monthly numeric,
  _new_monthly numeric,
  _effective_from date
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  _days_in_month int := EXTRACT(DAY FROM (date_trunc('month', _effective_from) + interval '1 month - 1 day'));
  _day_of_change int := EXTRACT(DAY FROM _effective_from)::int;
  _old_days int := _day_of_change - 1;
  _new_days int := _days_in_month - _old_days;
  _old_amt numeric := round(COALESCE(_old_monthly,0) / _days_in_month * _old_days, 2);
  _new_amt numeric := round(COALESCE(_new_monthly,0) / _days_in_month * _new_days, 2);
BEGIN
  RETURN jsonb_build_array(
    jsonb_build_object('label','Old rate',
      'rate', _old_monthly, 'days', _old_days,
      'from', to_char(date_trunc('month', _effective_from),'YYYY-MM-DD'),
      'to', to_char(_effective_from - 1,'YYYY-MM-DD'),
      'amount', _old_amt),
    jsonb_build_object('label','New rate',
      'rate', _new_monthly, 'days', _new_days,
      'from', to_char(_effective_from,'YYYY-MM-DD'),
      'to', to_char(date_trunc('month', _effective_from) + interval '1 month - 1 day','YYYY-MM-DD'),
      'amount', _new_amt)
  );
END;
$$;

-- A6. Disable destructive cascade on fee_packages — replaced by explicit RPC.
-- We don't drop the trigger (extend-only); we make the function a safe no-op,
-- and a new RPC handles revisions deliberately.
CREATE OR REPLACE FUNCTION public.cascade_fee_package_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- DEPRECATED: revisions are now driven by public.revise_billing_plan(...)
  -- so paid invoices are never silently mutated. Returning NEW preserves the
  -- trigger contract without altering any invoice or plan rows.
  RETURN NEW;
END; $$;

-- A7. Core RPC: create or revise a billing plan with full history
-- Returns the new plan row id. Caller (admin UI) decides effective_from.
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current_plan public.student_billing_plans%ROWTYPE;
  _new_plan_id uuid;
  _affected_month text := to_char(_effective_from,'YYYY-MM');
  _existing_invoice public.fee_invoices%ROWTYPE;
  _new_invoice_id uuid;
  _line_items jsonb;
  _amount numeric;
  _future_archived int := 0;
  _is_mid_month boolean := EXTRACT(DAY FROM _effective_from) <> 1;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Find current active plan for this student (if any)
  SELECT * INTO _current_plan FROM public.student_billing_plans
   WHERE student_id = _student_id AND superseded_by IS NULL AND is_active = true
   ORDER BY effective_from DESC, created_at DESC LIMIT 1;

  -- 2) Insert new plan row (never overwrite)
  INSERT INTO public.student_billing_plans(
    student_id, base_package_id, assignment_id, session_duration,
    duration_surcharge, flat_discount, net_recurring_fee, currency,
    is_active, branch_id, division_id, global_discount_id,
    effective_from, change_reason
  ) VALUES (
    _student_id, _base_package_id, _assignment_id, _session_duration,
    _duration_surcharge, _flat_discount, _net_recurring_fee, _currency,
    true, _branch_id, _division_id, _global_discount_id,
    _effective_from, _change_reason
  ) RETURNING id INTO _new_plan_id;

  -- 3) Supersede prior active plan (kept for audit)
  IF _current_plan.id IS NOT NULL THEN
    UPDATE public.student_billing_plans
       SET superseded_by = _new_plan_id, superseded_at = now(), is_active = false
     WHERE id = _current_plan.id;
  END IF;

  -- 4) Affected-month invoice handling
  SELECT * INTO _existing_invoice FROM public.fee_invoices
   WHERE student_id = _student_id AND billing_month = _affected_month
     AND is_archived = false
   ORDER BY created_at DESC LIMIT 1;

  IF _existing_invoice.id IS NOT NULL AND _existing_invoice.status = 'paid' THEN
    -- Paid: never touch. Revisions begin next billing cycle.
    NULL;
  ELSE
    IF _existing_invoice.id IS NOT NULL THEN
      UPDATE public.fee_invoices
         SET is_archived = true, archived_at = now(),
             archive_reason = COALESCE(_change_reason,'Plan revised')
       WHERE id = _existing_invoice.id;
    END IF;

    -- Build line items / amount
    IF _is_mid_month AND _current_plan.id IS NOT NULL THEN
      _line_items := public.build_split_month_lines(
        _current_plan.net_recurring_fee, _net_recurring_fee, _effective_from);
      _amount := (SELECT SUM((x->>'amount')::numeric)
                    FROM jsonb_array_elements(_line_items) x);
    ELSIF _is_mid_month THEN
      _amount := public.calc_prorated_amount(_net_recurring_fee, _effective_from);
      _line_items := jsonb_build_array(jsonb_build_object(
        'label','Prorated','rate', _net_recurring_fee,
        'from', to_char(_effective_from,'YYYY-MM-DD'),
        'to', to_char(date_trunc('month',_effective_from) + interval '1 month - 1 day','YYYY-MM-DD'),
        'amount', _amount));
    ELSE
      _amount := _net_recurring_fee;
      _line_items := NULL;
    END IF;

    INSERT INTO public.fee_invoices(
      assignment_id, student_id, amount, currency, billing_month,
      due_date, status, branch_id, division_id, plan_id,
      is_prorated, prorated_days, prorated_from_date,
      is_revised, revises_invoice_id, line_items
    ) VALUES (
      COALESCE(_assignment_id, _existing_invoice.assignment_id),
      _student_id, _amount, _currency, _affected_month,
      CASE WHEN _is_mid_month THEN _effective_from
           ELSE (date_trunc('month',_effective_from)::date + 9) END,
      'pending',
      COALESCE(_branch_id, _existing_invoice.branch_id),
      COALESCE(_division_id, _existing_invoice.division_id),
      _new_plan_id,
      _is_mid_month,
      CASE WHEN _is_mid_month THEN
        (EXTRACT(DAY FROM (date_trunc('month',_effective_from) + interval '1 month - 1 day'))
         - EXTRACT(DAY FROM _effective_from) + 1)::int
      END,
      CASE WHEN _is_mid_month THEN _effective_from END,
      _existing_invoice.id IS NOT NULL,
      _existing_invoice.id,
      _line_items
    ) RETURNING id INTO _new_invoice_id;

    IF _existing_invoice.id IS NOT NULL THEN
      UPDATE public.fee_invoices
         SET superseded_by_invoice_id = _new_invoice_id
       WHERE id = _existing_invoice.id;
    END IF;
  END IF;

  -- 5) Future pending invoices: archive + reissue at full new rate
  FOR _existing_invoice IN
    SELECT * FROM public.fee_invoices
     WHERE student_id = _student_id
       AND billing_month > _affected_month
       AND is_archived = false
       AND status = 'pending'
  LOOP
    UPDATE public.fee_invoices
       SET is_archived = true, archived_at = now(),
           archive_reason = COALESCE(_change_reason,'Plan revised — future invoice reissued')
     WHERE id = _existing_invoice.id;

    INSERT INTO public.fee_invoices(
      assignment_id, student_id, amount, currency, billing_month,
      due_date, status, branch_id, division_id, plan_id,
      is_revised, revises_invoice_id
    ) VALUES (
      _existing_invoice.assignment_id, _student_id, _net_recurring_fee, _currency,
      _existing_invoice.billing_month,
      (to_date(_existing_invoice.billing_month || '-01','YYYY-MM-DD') + 9)::date,
      'pending', _existing_invoice.branch_id, _existing_invoice.division_id, _new_plan_id,
      true, _existing_invoice.id
    ) RETURNING id INTO _new_invoice_id;

    UPDATE public.fee_invoices SET superseded_by_invoice_id = _new_invoice_id
     WHERE id = _existing_invoice.id;
    _future_archived := _future_archived + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'new_plan_id', _new_plan_id,
    'superseded_plan_id', _current_plan.id,
    'affected_month', _affected_month,
    'future_invoices_revised', _future_archived
  );
END; $$;

-- Preview helper: how many future pending invoices will be archived
CREATE OR REPLACE FUNCTION public.preview_plan_revision(_student_id uuid, _effective_from date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'affected_month_invoice', (SELECT to_jsonb(fi) FROM public.fee_invoices fi
        WHERE fi.student_id = _student_id
          AND fi.billing_month = to_char(_effective_from,'YYYY-MM')
          AND fi.is_archived = false ORDER BY created_at DESC LIMIT 1),
    'future_pending_count', (SELECT count(*) FROM public.fee_invoices
        WHERE student_id = _student_id
          AND billing_month > to_char(_effective_from,'YYYY-MM')
          AND is_archived = false AND status = 'pending')
  )
$$;
