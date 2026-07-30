CREATE OR REPLACE FUNCTION public.get_kit_quiz_questions_for_student(_kit_id uuid)
RETURNS TABLE (
  id uuid,
  kit_id uuid,
  question_index integer,
  type text,
  question text,
  options jsonb,
  difficulty text,
  blooms_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.kit_id, q.question_index, q.type, q.question, q.options, q.difficulty, q.blooms_level
  FROM public.quiz_questions q
  WHERE q.kit_id = _kit_id
    AND public.can_view_content_kit(q.kit_id)
  ORDER BY q.question_index
$$;

REVOKE ALL ON FUNCTION public.get_kit_quiz_questions_for_student(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_kit_quiz_questions_for_student(uuid) TO authenticated;