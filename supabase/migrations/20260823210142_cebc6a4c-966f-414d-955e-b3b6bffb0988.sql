CREATE OR REPLACE FUNCTION public.seed_schedule_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE assignment_start date;
BEGIN
  IF NEW.assignment_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(start_date, NEW.created_at::date) INTO assignment_start
  FROM public.student_teacher_assignments WHERE id = NEW.assignment_id;
  INSERT INTO public.schedule_periods (
    schedule_id, assignment_id, day_of_week, student_local_time, teacher_local_time,
    duration_minutes, period_type, effective_from, change_reason, created_by
  ) VALUES (
    NEW.id, NEW.assignment_id, lower(NEW.day_of_week), NEW.student_local_time,
    NEW.teacher_local_time, NEW.duration_minutes, 'permanent', assignment_start,
    'Initial recurring schedule', auth.uid()
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_schedule_period() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_schedule_period() TO service_role;
CREATE TRIGGER trg_seed_schedule_period
AFTER INSERT ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.seed_schedule_period();

CREATE OR REPLACE FUNCTION public.guard_schedule_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  baseline_assignment uuid;
  baseline_day text;
  student_id_value uuid;
  conflict_name text;
BEGIN
  SELECT s.assignment_id, lower(s.day_of_week), sta.student_id
    INTO baseline_assignment, baseline_day, student_id_value
  FROM public.schedules s
  JOIN public.student_teacher_assignments sta ON sta.id = s.assignment_id
  WHERE s.id = NEW.schedule_id;

  IF baseline_assignment IS NULL OR baseline_assignment <> NEW.assignment_id THEN
    RAISE EXCEPTION 'Schedule period must belong to the baseline schedule assignment';
  END IF;
  IF baseline_day <> lower(NEW.day_of_week) THEN
    RAISE EXCEPTION 'Schedule period weekday must match its baseline schedule';
  END IF;
  NEW.day_of_week := lower(NEW.day_of_week);
  NEW.updated_at := now();
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());

  IF NEW.period_type = 'temporary' AND EXISTS (
    SELECT 1 FROM public.schedule_periods p
    WHERE p.assignment_id = NEW.assignment_id
      AND p.day_of_week = NEW.day_of_week
      AND p.period_type = 'temporary'
      AND p.id IS DISTINCT FROM NEW.id
      AND daterange(p.effective_from, p.effective_to, '[]') && daterange(NEW.effective_from, NEW.effective_to, '[]')
  ) THEN
    RAISE EXCEPTION 'A temporary timing already covers part of this date range';
  END IF;

  SELECT other_profile.full_name INTO conflict_name
  FROM public.schedule_periods p
  JOIN public.student_teacher_assignments other_a ON other_a.id = p.assignment_id
  LEFT JOIN public.profiles other_profile ON other_profile.id = other_a.teacher_id
  WHERE other_a.student_id = student_id_value
    AND p.assignment_id <> NEW.assignment_id
    AND p.day_of_week = NEW.day_of_week
    AND daterange(p.effective_from, COALESCE(p.effective_to, 'infinity'::date), '[]')
        && daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')
    AND (p.student_local_time, p.student_local_time + make_interval(mins => p.duration_minutes))
        OVERLAPS (NEW.student_local_time, NEW.student_local_time + make_interval(mins => NEW.duration_minutes))
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION 'Schedule conflict: student already has a class with % during this effective period', conflict_name;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_schedule_period() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_schedule_period() TO service_role;