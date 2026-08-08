-- 1. Remove column-level SELECT on internal staff notes from general roles
REVOKE SELECT (examiner_remarks) ON public.exams FROM authenticated;
REVOKE SELECT (examiner_remarks) ON public.exams FROM anon;
GRANT ALL ON public.exams TO service_role;

-- 2. Staff-only accessor for internal remarks
CREATE OR REPLACE FUNCTION public.get_exam_examiner_remarks(_exam_ids uuid[])
RETURNS TABLE (id uuid, examiner_remarks text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.examiner_remarks
  FROM public.exams e
  WHERE e.id = ANY(_exam_ids)
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR (public.has_role(auth.uid(), 'examiner'::app_role))
      OR (
        public.has_role(auth.uid(), 'teacher'::app_role)
        AND e.student_id IN (
          SELECT sta.student_id FROM public.student_teacher_assignments sta
          WHERE sta.teacher_id = auth.uid()
        )
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_examiner_remarks(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_examiner_remarks(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exam_examiner_remarks(uuid[]) TO service_role;