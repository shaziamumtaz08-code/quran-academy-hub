CREATE OR REPLACE FUNCTION public.can_view_exam_template(_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.template_id = _template_id
      AND (
        e.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.student_parent_links spl
          WHERE spl.student_id = e.student_id AND spl.parent_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.student_id = e.student_id AND psl.parent_id = auth.uid()
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_exam_template(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_exam_template(uuid) TO authenticated;

CREATE POLICY "Students and parents can view templates of their own reports"
ON public.exam_templates
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.can_view_exam_template(id));

-- criteria/field definitions used to render the breakdown
CREATE POLICY "Students and parents can view fields of their own report templates"
ON public.exam_template_fields
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.can_view_exam_template(template_id));