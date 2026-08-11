-- 1. Lifecycle columns
ALTER TABLE public.student_billing_plans
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS billing_close_date date,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS closure_variance_reason text,
  ADD COLUMN IF NOT EXISTS pending_closure_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

ALTER TABLE public.student_billing_plans
  DROP CONSTRAINT IF EXISTS student_billing_plans_lifecycle_status_check;
ALTER TABLE public.student_billing_plans
  ADD CONSTRAINT student_billing_plans_lifecycle_status_check
  CHECK (lifecycle_status IN ('open','pending_closure','closed','suspended','superseded'));

-- 2. Backfill from existing flags
UPDATE public.student_billing_plans
   SET lifecycle_status = CASE
     WHEN superseded_by IS NOT NULL THEN 'superseded'
     WHEN is_active = false THEN 'closed'
     ELSE 'open'
   END;

CREATE INDEX IF NOT EXISTS idx_sbp_lifecycle ON public.student_billing_plans(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_sbp_assignment ON public.student_billing_plans(assignment_id) WHERE assignment_id IS NOT NULL;

-- 3. Credits / refunds
CREATE TABLE IF NOT EXISTS public.billing_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.student_billing_plans(id),
  assignment_id uuid REFERENCES public.student_teacher_assignments(id),
  source_invoice_id uuid REFERENCES public.fee_invoices(id),
  applied_invoice_id uuid REFERENCES public.fee_invoices(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PKR',
  kind text NOT NULL DEFAULT 'credit',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  proof_url text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_credits_kind_check CHECK (kind IN ('credit','refund')),
  CONSTRAINT billing_credits_status_check CHECK (status IN ('pending','applied','refunded','cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_credits TO authenticated;
GRANT ALL ON public.billing_credits TO service_role;
ALTER TABLE public.billing_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage billing credits" ON public.billing_credits;
CREATE POLICY "Admins manage billing credits" ON public.billing_credits
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin_fees'::app_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin_fees'::app_role));

DROP POLICY IF EXISTS "Students view own billing credits" ON public.billing_credits;
CREATE POLICY "Students view own billing credits" ON public.billing_credits
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP TRIGGER IF EXISTS trg_billing_credits_updated_at ON public.billing_credits;
CREATE TRIGGER trg_billing_credits_updated_at BEFORE UPDATE ON public.billing_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_billing_credits_student ON public.billing_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_credits_status ON public.billing_credits(status);

-- 4. Invoice generation respects lifecycle + billing close date (rest of logic unchanged)
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

  -- Lifecycle gate: closed / suspended / superseded plans never propose bills.
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

  SELECT date_trunc('month', COALESCE(a.effective_to_date, a.status_effective_date))::date
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

-- 5. Assignment ending flags the plan for review (no money is touched)
CREATE OR REPLACE FUNCTION public.fn_flag_billing_on_assignment_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IN ('left','completed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.student_billing_plans
       SET lifecycle_status = 'pending_closure',
           pending_closure_at = now(),
           billing_close_date = COALESCE(billing_close_date, NEW.effective_to_date, NEW.status_effective_date, CURRENT_DATE),
           updated_at = now()
     WHERE assignment_id = NEW.id
       AND lifecycle_status = 'open';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_flag_billing_on_assignment_end ON public.student_teacher_assignments;
CREATE TRIGGER trg_flag_billing_on_assignment_end
  AFTER UPDATE OF status ON public.student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_flag_billing_on_assignment_end();

-- 6. Transactional close-out RPC
CREATE OR REPLACE FUNCTION public.close_billing_plan(
  _plan_id uuid,
  _close_date date,
  _reason text DEFAULT NULL,
  _credit_kind text DEFAULT 'credit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  p public.student_billing_plans%ROWTYPE;
  a public.student_teacher_assignments%ROWTYPE;
  close_month text;
  month_first date;
  month_last date;
  days_in_month int;
  active_from date;
  active_days int;
  earned numeric := 0;
  inv public.fee_invoices%ROWTYPE;
  voided_count int := 0;
  paid_total numeric := 0;
  overpay numeric := 0;
  credit_id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin_fees'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised to close billing plans';
  END IF;

  SELECT * INTO p FROM public.student_billing_plans WHERE id = _plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing plan not found'; END IF;
  IF p.lifecycle_status = 'closed' THEN RAISE EXCEPTION 'Billing plan already closed'; END IF;
  IF _close_date IS NULL THEN RAISE EXCEPTION 'Billing close date is required'; END IF;

  IF p.assignment_id IS NOT NULL THEN
    SELECT * INTO a FROM public.student_teacher_assignments WHERE id = p.assignment_id;
    IF COALESCE(a.effective_to_date, a.status_effective_date) IS DISTINCT FROM _close_date
       AND COALESCE(btrim(_reason), '') = '' THEN
      RAISE EXCEPTION 'A reason is required when the billing close date differs from the assignment end date';
    END IF;
  END IF;

  close_month := to_char(_close_date, 'YYYY-MM');
  month_first := date_trunc('month', _close_date)::date;
  month_last := (month_first + interval '1 month - 1 day')::date;
  days_in_month := extract(day from month_last)::int;
  active_from := GREATEST(month_first, p.effective_from);
  active_days := GREATEST(0, (_close_date - active_from) + 1);
  earned := CASE WHEN active_days >= days_in_month THEN p.net_recurring_fee
                 ELSE round((p.net_recurring_fee::numeric / days_in_month) * active_days, 2) END;

  -- Final month invoice
  SELECT * INTO inv FROM public.fee_invoices
   WHERE plan_id = p.id AND billing_month = close_month
     AND is_archived = false AND voided_at IS NULL AND status <> 'voided'
   ORDER BY created_at DESC LIMIT 1;

  IF inv.id IS NOT NULL THEN
    paid_total := COALESCE(inv.amount_paid, 0);
    IF paid_total = 0 THEN
      UPDATE public.fee_invoices
         SET amount = earned,
             period_to = _close_date,
             is_prorated = active_days <> days_in_month,
             prorated_days = active_days,
             prorated_from_date = active_from,
             updated_at = now()
       WHERE id = inv.id;
      INSERT INTO public.invoice_adjustments(invoice_id, action_type, previous_values, new_values, reason, admin_id, admin_name)
      VALUES (inv.id, 'billing_close_out',
              jsonb_build_object('amount', inv.amount, 'period_to', inv.period_to),
              jsonb_build_object('amount', earned, 'period_to', _close_date),
              COALESCE(_reason, 'Billing closed on ' || _close_date), auth.uid(), 'system:close_billing_plan');
    ELSE
      overpay := GREATEST(0, paid_total - earned);
    END IF;
  END IF;

  -- Void future unpaid invoices only
  UPDATE public.fee_invoices
     SET voided_at = now(), status = 'voided',
         void_reason = COALESCE(_reason, 'billing_closed'), updated_at = now()
   WHERE plan_id = p.id
     AND billing_month > close_month
     AND status = 'pending'
     AND COALESCE(amount_paid, 0) = 0
     AND is_archived = false
     AND voided_at IS NULL;
  GET DIAGNOSTICS voided_count = ROW_COUNT;

  -- Overpayment on later months that were already paid also becomes a credit
  SELECT overpay + COALESCE(SUM(amount_paid), 0) INTO overpay
    FROM public.fee_invoices
   WHERE plan_id = p.id AND billing_month > close_month
     AND COALESCE(amount_paid, 0) > 0 AND is_archived = false AND voided_at IS NULL;

  IF overpay > 0 THEN
    INSERT INTO public.billing_credits(
      student_id, plan_id, assignment_id, source_invoice_id, amount, currency,
      kind, status, reason, branch_id, division_id, created_by
    ) VALUES (
      p.student_id, p.id, p.assignment_id, inv.id, round(overpay, 2), COALESCE(p.currency, 'PKR'),
      CASE WHEN _credit_kind = 'refund' THEN 'refund' ELSE 'credit' END, 'pending',
      COALESCE(_reason, 'Overpayment at billing close-out on ' || _close_date),
      p.branch_id, p.division_id, auth.uid()
    ) RETURNING id INTO credit_id;
  END IF;

  UPDATE public.student_billing_plans
     SET lifecycle_status = 'closed',
         is_active = false,
         billing_close_date = _close_date,
         close_reason = _reason,
         closure_variance_reason = CASE
           WHEN a.id IS NOT NULL AND COALESCE(a.effective_to_date, a.status_effective_date) IS DISTINCT FROM _close_date
           THEN _reason ELSE closure_variance_reason END,
         closed_at = now(),
         closed_by = auth.uid(),
         updated_at = now()
   WHERE id = p.id;

  INSERT INTO public.billing_plan_history(plan_id, changed_by, effective_from, previous_values, new_values, reason)
  VALUES (p.id, auth.uid(), to_char(_close_date, 'YYYY-MM-DD'),
          jsonb_build_object('lifecycle_status', p.lifecycle_status),
          jsonb_build_object('lifecycle_status', 'closed', 'billing_close_date', _close_date,
                             'earned', earned, 'voided_invoices', voided_count, 'credit_amount', overpay),
          _reason);

  RETURN jsonb_build_object(
    'plan_id', p.id, 'billing_close_date', _close_date, 'earned', earned,
    'paid', paid_total, 'credit_amount', round(overpay, 2), 'credit_id', credit_id,
    'voided_invoices', voided_count
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.close_billing_plan(uuid, date, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_billing_plan(uuid, date, text, text) TO authenticated;