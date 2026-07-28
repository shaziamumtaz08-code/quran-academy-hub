-- 1) Remove direct student read access to quiz_banks (contains question_bank answer key)
DROP POLICY IF EXISTS "Students view published quiz banks" ON public.quiz_banks;

-- 2) Safe listing of live authenticated quiz sessions for the current student
CREATE OR REPLACE FUNCTION public.get_student_quiz_sessions()
RETURNS TABLE (
  session_id uuid,
  session_title text,
  quiz_bank_id uuid,
  name text,
  description text,
  language text,
  questions_per_attempt integer,
  time_limit_minutes integer,
  max_attempts integer,
  passing_percentage numeric,
  course_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, b.id, b.name, b.description, b.language,
         b.questions_per_attempt, b.time_limit_minutes, b.max_attempts,
         b.passing_percentage, b.course_id
  FROM public.quiz_sessions s
  JOIN public.quiz_banks b ON b.id = s.quiz_bank_id
  WHERE s.status = 'live'
    AND b.status = 'published'
    AND b.mode = 'authenticated'
    AND public.is_enrolled_in_course(auth.uid(), b.course_id)
$$;

GRANT EXECUTE ON FUNCTION public.get_student_quiz_sessions() TO authenticated;

-- 3) Server-side attempt creation: picks questions and returns them WITHOUT answers
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank public.quiz_banks%ROWTYPE;
  v_num int;
  v_selected jsonb;
  v_attempt_id uuid;
  v_used int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT b.* INTO v_bank
  FROM public.quiz_sessions s
  JOIN public.quiz_banks b ON b.id = s.quiz_bank_id
  WHERE s.id = _session_id AND s.status = 'live'
    AND b.status = 'published' AND b.mode = 'authenticated';

  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'Quiz not available';
  END IF;

  IF NOT public.is_enrolled_in_course(auth.uid(), v_bank.course_id) THEN
    RAISE EXCEPTION 'Not enrolled in this course';
  END IF;

  SELECT count(*) INTO v_used FROM public.quiz_attempts
  WHERE session_id = _session_id AND student_id = auth.uid() AND status = 'completed';

  IF v_bank.max_attempts IS NOT NULL AND v_used >= v_bank.max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  v_num := LEAST(COALESCE(v_bank.questions_per_attempt, 10),
                 COALESCE(jsonb_array_length(v_bank.question_bank), 0));

  IF v_num < 1 THEN
    RAISE EXCEPTION 'This quiz has no questions yet';
  END IF;

  SELECT jsonb_agg(q ORDER BY rn) INTO v_selected
  FROM (
    SELECT q, row_number() OVER () AS rn
    FROM (
      SELECT q FROM jsonb_array_elements(v_bank.question_bank) q ORDER BY random() LIMIT v_num
    ) picked
  ) ordered;

  INSERT INTO public.quiz_attempts (session_id, quiz_bank_id, student_id, questions, max_score, status)
  VALUES (_session_id, v_bank.id, auth.uid(), v_selected, v_num, 'in_progress')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'index', (idx - 1),
        'text', item->>'text',
        'type', item->>'type',
        'options', COALESCE(item->'options', '[]'::jsonb)
      ) ORDER BY idx), '[]'::jsonb)
      FROM jsonb_array_elements(v_selected) WITH ORDINALITY AS t(item, idx)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated;