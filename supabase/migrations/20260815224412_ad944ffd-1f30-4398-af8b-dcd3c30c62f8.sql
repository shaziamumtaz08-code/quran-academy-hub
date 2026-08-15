-- 1. Payout rate: remove direct column read for app roles
REVOKE SELECT (default_payout_rate) ON public.profiles FROM authenticated;
REVOKE SELECT (default_payout_rate) ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_payout_rates(_user_ids uuid[])
RETURNS TABLE(user_id uuid, default_payout_rate numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.default_payout_rate
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND (
      p.id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin_fees'::app_role)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_payout_rates(uuid[]) TO authenticated;

-- 2. revise_billing_plan: keep the assignment link + require a real reason
CREATE OR REPLACE FUNCTION public.revise_billing_plan(_student_id uuid, _base_package_id uuid, _session_duration integer, _flat_discount numeric, _global_discount_id uuid, _net_recurring_fee numeric, _currency text, _effective_from date, _change_reason text DEFAULT NULL::text, _assignment_id uuid DEFAULT NULL::uuid, _branch_id uuid DEFAULT NULL::uuid, _division_id uuid DEFAULT NULL::uuid, _duration_surcharge numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_plan public.student_billing_plans%ROWTYPE;
  new_plan_id uuid;
  inv public.fee_invoices%ROWTYPE;
  new_invoice_id uuid;
  affected_month text := to_char(_effective_from, 'YYYY-MM');
  refreshed int := 0;
  reason_text text := NULLIF(btrim(COALESCE(_change_reason, '')), '');
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF reason_text IS NULL
     OR length(regexp_replace(reason_text, '[^a-zA-Z0-9]', '', 'g')) < 4
     OR lower(regexp_replace(reason_text, '[^a-zA-Z0-9]', '', 'g')) IN ('na','none','test','noneed','nil','asdf','xxxx','same') THEN
    RAISE EXCEPTION 'A meaningful reason is required for every billing plan change (min 4 characters).';
  END IF;

  IF _effective_from IS NULL OR COALESCE(_net_recurring_fee, 0) <= 0 THEN
    RAISE EXCEPTION 'Effective date and a positive recurring fee are required';
  END IF;

  SELECT * INTO old_plan
  FROM public.student_billing_plans
  WHERE student_id = _student_id
    AND superseded_by IS NULL
    AND is_active = true
    AND (_assignment_id IS NULL OR assignment_id = _assignment_id)
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.student_billing_plans(
    student_id, base_package_id, assignment_id, session_duration,
    duration_surcharge, flat_discount, net_recurring_fee, currency,
    is_active, branch_id, division_id, global_discount_id,
    effective_from, change_reason
  ) VALUES (
    _student_id, _base_package_id,
    COALESCE(_assignment_id, old_plan.assignment_id),
    _session_duration,
    _duration_surcharge, _flat_discount, _net_recurring_fee, _currency,
    false, COALESCE(_branch_id, old_plan.branch_id), COALESCE(_division_id, old_plan.division_id),
    _global_discount_id,
    _effective_from, reason_text
  ) RETURNING id INTO new_plan_id;

  IF old_plan.id IS NOT NULL THEN
    UPDATE public.student_billing_plans
       SET superseded_by = new_plan_id,
           superseded_at = now(),
           is_active = false,
           change_reason = reason_text
     WHERE id = old_plan.id;

    INSERT INTO public.billing_plan_history(
      plan_id, changed_by, effective_from, previous_values, new_values, reason
    ) VALUES (
      new_plan_id, auth.uid(), _effective_from::text,
      to_jsonb(old_plan),
      jsonb_build_object(
        'id', new_plan_id,
        'student_id', _student_id,
        'base_package_id', _base_package_id,
        'session_duration', _session_duration,
        'duration_surcharge', _duration_surcharge,
        'flat_discount', _flat_discount,
        'global_discount_id', _global_discount_id,
        'net_recurring_fee', _net_recurring_fee,
        'currency', _currency,
        'effective_from', _effective_from,
        'assignment_id', COALESCE(_assignment_id, old_plan.assignment_id)
      ),
      reason_text
    );
  END IF;

  FOR inv IN
    SELECT * FROM public.fee_invoices
    WHERE student_id = _student_id
      AND billing_month >= affected_month
      AND is_archived = false
      AND voided_at IS NULL
      AND status <> 'paid'
      AND COALESCE(amount_paid, 0) = 0
      AND (
        _assignment_id IS NULL
        OR assignment_id = _assignment_id
        OR (old_plan.id IS NOT NULL AND plan_id = old_plan.id)
      )
    ORDER BY billing_month, created_at
    FOR UPDATE
  LOOP
    UPDATE public.fee_invoices
       SET is_archived = true,
           archived_at = now(),
           archive_reason = reason_text,
           updated_at = now()
     WHERE id = inv.id;
    refreshed := refreshed + 1;
  END LOOP;

  UPDATE public.student_billing_plans
     SET is_active = true
   WHERE id = new_plan_id;

  PERFORM public.auto_generate_plan_invoices(new_plan_id);

  FOR inv IN
    SELECT * FROM public.fee_invoices
    WHERE student_id = _student_id
      AND plan_id = new_plan_id
      AND billing_month >= affected_month
      AND is_archived = false
      AND voided_at IS NULL
  LOOP
    SELECT id INTO new_invoice_id
    FROM public.fee_invoices
    WHERE student_id = _student_id
      AND billing_month = inv.billing_month
      AND is_archived = true
      AND archived_at IS NOT NULL
    ORDER BY archived_at DESC
    LIMIT 1;

    IF new_invoice_id IS NOT NULL THEN
      UPDATE public.fee_invoices
         SET is_revised = true,
             revises_invoice_id = new_invoice_id
       WHERE id = inv.id;
      UPDATE public.fee_invoices
         SET superseded_by_invoice_id = inv.id
       WHERE id = new_invoice_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'new_plan_id', new_plan_id,
    'superseded_plan_id', old_plan.id,
    'affected_month', affected_month,
    'future_invoices_revised', refreshed
  );
END;
$function$;