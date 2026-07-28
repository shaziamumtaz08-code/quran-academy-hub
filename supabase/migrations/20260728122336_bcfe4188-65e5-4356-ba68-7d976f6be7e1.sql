CREATE OR REPLACE FUNCTION public.fn_log_assignment_window_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  _win_from := NEW.effective_from_date;
  _win_to := COALESCE(
    NEW.effective_to_date,
    CASE WHEN NEW.status IN ('completed','left','on_hold') THEN CURRENT_DATE ELSE NULL END
  );

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

  -- salary_payouts has no pay_period_* columns; period is derived from salary_month (YYYY-MM)
  SELECT COUNT(*) INTO _paid_pay
    FROM public.salary_payouts sp
   WHERE sp.teacher_id = NEW.teacher_id
     AND sp.voided_at IS NULL
     AND sp.status = 'paid'
     AND sp.salary_month ~ '^\d{4}-\d{2}$'
     AND (
       (_win_from IS NOT NULL
         AND (to_date(sp.salary_month, 'YYYY-MM') + interval '1 month - 1 day')::date < _win_from)
       OR
       (_win_to IS NOT NULL
         AND to_date(sp.salary_month, 'YYYY-MM') > _win_to)
     );

  SELECT COUNT(*) INTO _flags
    FROM public.at_risk_flags
   WHERE student_id = NEW.student_id;

  _retro := (_paid_inv > 0 OR _att > 0 OR _paid_pay > 0);

  IF _retro AND (COALESCE(NULLIF(trim(NEW.status_change_reason), ''), NULL) IS NULL) THEN
    RAISE EXCEPTION 'Retroactive window change requires a reason. This change would exclude % paid invoice(s), % attendance record(s), and % paid payout(s) from accountability. Please set status_change_reason.',
      _paid_inv, _att, _paid_pay;
  END IF;

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

  UPDATE public.at_risk_flags
     SET period_excluded_at = now(),
         period_excluded_by_assignment_change = _log_id
   WHERE student_id = NEW.student_id
     AND period_excluded_at IS NULL
     AND (
       (_win_from IS NOT NULL AND detected_at::date < _win_from) OR
       (_win_to IS NOT NULL AND detected_at::date > _win_to)
     );

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
$fn$;