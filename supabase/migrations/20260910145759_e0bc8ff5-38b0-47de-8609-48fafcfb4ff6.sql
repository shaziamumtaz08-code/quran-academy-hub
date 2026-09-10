CREATE OR REPLACE FUNCTION public.apply_schedule_period(
  _schedule_id uuid,
  _student_local_time time without time zone,
  _teacher_local_time time without time zone,
  _duration_minutes integer,
  _period_type public.schedule_period_type,
  _effective_from date,
  _effective_to date,
  _change_reason text,
  _batch_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s record;
  prior_id uuid;
  new_id uuid;
  next_from date;
  capped boolean := false;
  actor_name text;
  actor_email text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can change schedule timings';
  END IF;

  SELECT * INTO s FROM public.schedules WHERE id = _schedule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  IF _effective_from IS NULL THEN
    RAISE EXCEPTION 'A start date is required';
  END IF;

  IF _period_type = 'temporary' AND _effective_to IS NULL THEN
    RAISE EXCEPTION 'A temporary change needs an end date';
  END IF;

  IF _effective_to IS NOT NULL AND _effective_to < _effective_from THEN
    RAISE EXCEPTION 'The end date cannot be before the start date';
  END IF;

  IF _change_reason IS NULL OR length(btrim(_change_reason)) < 4 THEN
    RAISE EXCEPTION 'Please give a short reason for this change';
  END IF;

  SELECT id INTO prior_id
  FROM public.schedule_periods
  WHERE schedule_id = _schedule_id
    AND period_type = 'permanent'
    AND effective_from < _effective_from
    AND (effective_to IS NULL OR effective_to >= _effective_from)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF prior_id IS NOT NULL AND _period_type = 'permanent' THEN
    UPDATE public.schedule_periods
       SET effective_to = _effective_from - 1,
           updated_at = now()
     WHERE id = prior_id AND effective_from < _effective_from;
  END IF;

  -- Back-dated insert landing before an already-saved later period: cap this one
  -- the day before the next period begins so the two never overlap.
  SELECT MIN(effective_from) INTO next_from
  FROM public.schedule_periods
  WHERE schedule_id = _schedule_id
    AND effective_from > _effective_from;

  IF next_from IS NOT NULL AND (_effective_to IS NULL OR _effective_to >= next_from) THEN
    _effective_to := next_from - 1;
    capped := true;
  END IF;

  INSERT INTO public.schedule_periods (
    schedule_id, assignment_id, day_of_week, student_local_time, teacher_local_time,
    duration_minutes, period_type, effective_from, effective_to, change_reason, created_by
  ) VALUES (
    s.id, s.assignment_id, lower(s.day_of_week), _student_local_time, _teacher_local_time,
    _duration_minutes, _period_type, _effective_from, _effective_to,
    btrim(_change_reason), auth.uid()
  ) RETURNING id INTO new_id;

  IF prior_id IS NOT NULL THEN
    UPDATE public.schedule_periods SET superseded_by = new_id, updated_at = now() WHERE id = prior_id;
  END IF;

  IF _period_type = 'permanent' AND _effective_from <= current_date
     AND (_effective_to IS NULL OR _effective_to >= current_date) THEN
    UPDATE public.schedules SET
      student_local_time = _student_local_time,
      teacher_local_time = _teacher_local_time,
      duration_minutes = _duration_minutes,
      updated_at = now()
    WHERE id = _schedule_id;
  END IF;

  -- Only a genuine, admin-supplied past end with no later timing means the
  -- weekly class has stopped. An auto-cap before a newer period must not
  -- deactivate a class that is still running.
  IF _period_type = 'permanent' AND NOT capped AND next_from IS NULL
     AND _effective_to IS NOT NULL AND _effective_to < current_date THEN
    UPDATE public.schedules SET is_active = false, updated_at = now() WHERE id = _schedule_id;
  END IF;

  SELECT COALESCE(full_name, 'Unknown'), email INTO actor_name, actor_email
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.system_logs (
    user_id, user_full_name, user_email, action, entity_type, entity_id,
    entity_label, division_id, old_values, new_values, details
  ) VALUES (
    auth.uid(), COALESCE(actor_name, 'System'), actor_email,
    'schedule_period_applied', 'schedule_period', new_id,
    initcap(lower(s.day_of_week)) || ' ' || to_char(_student_local_time, 'HH12:MI AM'),
    s.division_id,
    jsonb_build_object(
      'student_local_time', s.student_local_time,
      'teacher_local_time', s.teacher_local_time,
      'duration_minutes', s.duration_minutes
    ),
    jsonb_build_object(
      'student_local_time', _student_local_time,
      'teacher_local_time', _teacher_local_time,
      'duration_minutes', _duration_minutes
    ),
    jsonb_build_object(
      'schedule_id', _schedule_id,
      'assignment_id', s.assignment_id,
      'period_type', _period_type,
      'effective_from', _effective_from,
      'effective_to', _effective_to,
      'capped_by_later_period', capped,
      'is_backdated', _effective_from < current_date,
      'batch_id', _batch_id,
      'change_reason', btrim(_change_reason)
    )
  );

  RETURN new_id;
END;
$function$;