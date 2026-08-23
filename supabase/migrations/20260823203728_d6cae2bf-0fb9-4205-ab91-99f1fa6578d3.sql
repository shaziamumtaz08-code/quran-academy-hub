CREATE TYPE public.schedule_period_type AS ENUM ('permanent', 'temporary');

CREATE TABLE public.schedule_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])),
  student_local_time time NOT NULL,
  teacher_local_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 180),
  period_type public.schedule_period_type NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  change_reason text NOT NULL CHECK (char_length(btrim(change_reason)) >= 4),
  created_by uuid,
  superseded_by uuid REFERENCES public.schedule_periods(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (period_type = 'permanent' OR effective_to IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_periods TO authenticated;
GRANT ALL ON public.schedule_periods TO service_role;

ALTER TABLE public.schedule_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schedule periods"
ON public.schedule_periods AS PERMISSIVE FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers view assigned schedule periods"
ON public.schedule_periods AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_teacher_assignments sta
  WHERE sta.id = schedule_periods.assignment_id AND sta.teacher_id = auth.uid()
));

CREATE POLICY "Students view own schedule periods"
ON public.schedule_periods AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_teacher_assignments sta
  WHERE sta.id = schedule_periods.assignment_id AND sta.student_id = auth.uid()
));

CREATE POLICY "Parents view child schedule periods"
ON public.schedule_periods AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_teacher_assignments sta
  WHERE sta.id = schedule_periods.assignment_id
    AND sta.student_id IN (SELECT public.get_parent_children_ids(auth.uid()))
));

CREATE INDEX idx_schedule_periods_assignment_date
ON public.schedule_periods (assignment_id, day_of_week, effective_from, effective_to);
CREATE INDEX idx_schedule_periods_schedule
ON public.schedule_periods (schedule_id);

CREATE OR REPLACE FUNCTION public.guard_schedule_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  baseline_assignment uuid;
  baseline_day text;
  conflict_exists boolean;
BEGIN
  SELECT assignment_id, lower(day_of_week)
    INTO baseline_assignment, baseline_day
  FROM public.schedules
  WHERE id = NEW.schedule_id;

  IF baseline_assignment IS NULL OR baseline_assignment <> NEW.assignment_id THEN
    RAISE EXCEPTION 'Schedule period must belong to the baseline schedule assignment';
  END IF;
  IF baseline_day <> lower(NEW.day_of_week) THEN
    RAISE EXCEPTION 'Schedule period weekday must match its baseline schedule';
  END IF;
  NEW.day_of_week := lower(NEW.day_of_week);
  NEW.updated_at := now();
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());

  IF NEW.period_type = 'temporary' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.schedule_periods p
      WHERE p.assignment_id = NEW.assignment_id
        AND p.day_of_week = NEW.day_of_week
        AND p.period_type = 'temporary'
        AND p.id IS DISTINCT FROM NEW.id
        AND daterange(p.effective_from, p.effective_to, '[]') && daterange(NEW.effective_from, NEW.effective_to, '[]')
    ) INTO conflict_exists;
    IF conflict_exists THEN
      RAISE EXCEPTION 'A temporary timing already covers part of this date range';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_schedule_period
BEFORE INSERT OR UPDATE ON public.schedule_periods
FOR EACH ROW EXECUTE FUNCTION public.guard_schedule_period();

CREATE OR REPLACE FUNCTION public.apply_schedule_period(
  _schedule_id uuid,
  _student_local_time time,
  _teacher_local_time time,
  _duration_minutes integer,
  _period_type public.schedule_period_type,
  _effective_from date,
  _effective_to date,
  _change_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.schedules%ROWTYPE;
  new_id uuid;
  prior_id uuid;
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
  IF _duration_minutes NOT BETWEEN 5 AND 180 THEN
    RAISE EXCEPTION 'Duration must be between 5 and 180 minutes';
  END IF;

  SELECT * INTO s FROM public.schedules WHERE id = _schedule_id AND assignment_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found'; END IF;

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
    _duration_minutes, _period_type, _effective_from,
    CASE WHEN _period_type = 'temporary' THEN _effective_to ELSE NULL END,
    btrim(_change_reason), auth.uid()
  ) RETURNING id INTO new_id;

  IF prior_id IS NOT NULL THEN
    UPDATE public.schedule_periods SET superseded_by = new_id, updated_at = now() WHERE id = prior_id;
  END IF;

  IF _period_type = 'permanent' AND _effective_from <= current_date THEN
    UPDATE public.schedules SET
      student_local_time = _student_local_time,
      teacher_local_time = _teacher_local_time,
      duration_minutes = _duration_minutes,
      updated_at = now()
    WHERE id = _schedule_id;
  END IF;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_schedule_period(uuid,time,time,integer,public.schedule_period_type,date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_schedule_period(uuid,time,time,integer,public.schedule_period_type,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_schedule_period(uuid,time,time,integer,public.schedule_period_type,date,date,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_effective_schedule_periods(_on_date date)
RETURNS SETOF public.schedule_periods
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.schedule_id) p.*
  FROM public.schedule_periods p
  WHERE p.effective_from <= _on_date
    AND (p.effective_to IS NULL OR p.effective_to >= _on_date)
    AND lower(p.day_of_week) = lower(to_char(_on_date, 'FMDay'))
  ORDER BY p.schedule_id,
    CASE WHEN p.period_type = 'temporary' THEN 0 ELSE 1 END,
    p.effective_from DESC,
    p.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_schedule_periods(date) TO authenticated, service_role;

INSERT INTO public.schedule_periods (
  schedule_id, assignment_id, day_of_week, student_local_time, teacher_local_time,
  duration_minutes, period_type, effective_from, effective_to, change_reason, created_by
)
SELECT s.id, s.assignment_id, lower(s.day_of_week), s.student_local_time, s.teacher_local_time,
       s.duration_minutes, 'permanent'::public.schedule_period_type,
       COALESCE(sta.start_date, s.created_at::date), NULL, 'Existing recurring schedule baseline', NULL
FROM public.schedules s
JOIN public.student_teacher_assignments sta ON sta.id = s.assignment_id
WHERE s.assignment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.schedule_periods p WHERE p.schedule_id = s.id);

CREATE OR REPLACE FUNCTION public.guard_student_grading_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.fn_is_grading_staff(auth.uid()) THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'speaking_assignment_submissions' AND OLD.student_id = auth.uid() THEN
    IF NEW.final_score IS DISTINCT FROM OLD.final_score OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'Students cannot change speaking-assignment grading fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'teaching_exam_submissions' AND OLD.student_id = auth.uid() THEN
    IF NEW.total_score IS DISTINCT FROM OLD.total_score
       OR NEW.total_possible IS DISTINCT FROM OLD.total_possible
       OR NEW.percentage IS DISTINCT FROM OLD.percentage
       OR NEW.passed IS DISTINCT FROM OLD.passed THEN
      RAISE EXCEPTION 'Students cannot change teaching-exam grading fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'teaching_exam_responses' THEN
    IF EXISTS (SELECT 1 FROM public.teaching_exam_submissions s WHERE s.id = OLD.submission_id AND s.student_id = auth.uid())
       AND (NEW.is_correct IS DISTINCT FROM OLD.is_correct
         OR NEW.score_awarded IS DISTINCT FROM OLD.score_awarded
         OR NEW.ai_score IS DISTINCT FROM OLD.ai_score
         OR NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback
         OR NEW.ai_confidence IS DISTINCT FROM OLD.ai_confidence
         OR NEW.teacher_score IS DISTINCT FROM OLD.teacher_score
         OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback
         OR NEW.teacher_reviewed IS DISTINCT FROM OLD.teacher_reviewed
         OR NEW.rubric_breakdown IS DISTINCT FROM OLD.rubric_breakdown
         OR NEW.marked_at IS DISTINCT FROM OLD.marked_at) THEN
      RAISE EXCEPTION 'Students cannot change teaching-exam grading fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_speaking_submission_grades
BEFORE UPDATE ON public.speaking_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grading_fields();
CREATE TRIGGER trg_guard_teaching_exam_submission_grades
BEFORE UPDATE ON public.teaching_exam_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grading_fields();
CREATE TRIGGER trg_guard_teaching_exam_response_grades
BEFORE UPDATE ON public.teaching_exam_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grading_fields();