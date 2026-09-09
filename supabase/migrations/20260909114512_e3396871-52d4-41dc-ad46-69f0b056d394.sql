create or replace function public.apply_schedule_period(
  _schedule_id uuid,
  _student_local_time time without time zone,
  _teacher_local_time time without time zone,
  _duration_minutes integer,
  _period_type public.schedule_period_type,
  _effective_from date,
  _effective_to date,
  _change_reason text,
  _batch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  s public.schedules%ROWTYPE;
  new_id uuid;
  prior_id uuid;
  next_from date;
  actor_name text;
  actor_email text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only administrators can change recurring schedule periods';
  END IF;
  IF char_length(btrim(COALESCE(_change_reason, ''))) < 4 THEN
    RAISE EXCEPTION 'A change reason of at least 4 characters is required';
  END IF;
  IF _period_type = 'temporary' AND (_effective_to IS NULL OR _effective_to < _effective_from) THEN
    RAISE EXCEPTION 'Temporary timing requires a valid end date';
  END IF;
  IF _effective_to IS NOT NULL AND _effective_to < _effective_from THEN
    RAISE EXCEPTION 'End date cannot be before the start date';
  END IF;
  IF _duration_minutes NOT BETWEEN 5 AND 180 THEN
    RAISE EXCEPTION 'Duration must be between 5 and 180 minutes';
  END IF;

  SELECT * INTO s FROM public.schedules WHERE id = _schedule_id AND assignment_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found'; END IF;

  -- Effective dates no longer have to land on the class weekday: back-dated and
  -- mid-week corrections are both legitimate.

  IF _period_type = 'permanent' THEN
    SELECT id INTO prior_id
    FROM public.schedule_periods
    WHERE schedule_id = _schedule_id
      AND period_type = 'permanent'
      AND effective_from <= _effective_from
      AND (effective_to IS NULL OR effective_to >= _effective_from)
    ORDER BY effective_from DESC, created_at DESC LIMIT 1;

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

  IF _period_type = 'permanent' AND _effective_to IS NOT NULL AND _effective_to < current_date THEN
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
      'schedule_id', s.id,
      'assignment_id', s.assignment_id,
      'day_of_week', lower(s.day_of_week),
      'period_type', _period_type,
      'effective_from', _effective_from,
      'effective_to', _effective_to,
      'is_backdated', (_effective_from < current_date),
      'batch_id', _batch_id,
      'change_reason', btrim(_change_reason)
    )
  );

  RETURN new_id;
END;
$$;

revoke all on function public.apply_schedule_period(uuid, time without time zone, time without time zone, integer, public.schedule_period_type, date, date, text, uuid) from public, anon;
grant execute on function public.apply_schedule_period(uuid, time without time zone, time without time zone, integer, public.schedule_period_type, date, date, text, uuid) to authenticated;