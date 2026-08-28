CREATE OR REPLACE FUNCTION public.apply_schedule_period(_schedule_id uuid, _student_local_time time without time zone, _teacher_local_time time without time zone, _duration_minutes integer, _period_type schedule_period_type, _effective_from date, _effective_to date, _change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.schedules%ROWTYPE;
  new_id uuid;
  prior_id uuid;
  sched_dow int;
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

  sched_dow := CASE lower(s.day_of_week)
    WHEN 'sunday' THEN 0 WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 END;

  IF sched_dow IS NOT NULL THEN
    IF EXTRACT(DOW FROM _effective_from)::int <> sched_dow THEN
      RAISE EXCEPTION 'Start date must fall on a %', initcap(s.day_of_week);
    END IF;
    IF _effective_to IS NOT NULL AND EXTRACT(DOW FROM _effective_to)::int <> sched_dow THEN
      RAISE EXCEPTION 'End date must fall on a %', initcap(s.day_of_week);
    END IF;
  END IF;

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

    IF prior_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.schedule_periods WHERE id = prior_id AND effective_from = _effective_from
    ) THEN
      RAISE EXCEPTION 'A permanent timing already starts on this date';
    END IF;
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

  -- A permanent period that has already ended means the weekly class is discontinued
  IF _period_type = 'permanent' AND _effective_to IS NOT NULL AND _effective_to < current_date THEN
    UPDATE public.schedules SET is_active = false, updated_at = now() WHERE id = _schedule_id;
  END IF;

  RETURN new_id;
END;
$function$;