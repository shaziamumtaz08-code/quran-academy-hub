REVOKE EXECUTE ON FUNCTION public.can_view_exam_template(uuid) FROM anon;

DROP POLICY IF EXISTS "Teachers can view course assets" ON public.course_assets;
CREATE POLICY "Teachers can view assigned course assets"
ON public.course_assets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND linked_course_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_assets.linked_course_id AND c.teacher_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_class_staff s
      JOIN public.course_classes cc ON cc.id = s.class_id
      WHERE cc.course_id = course_assets.linked_course_id AND s.user_id = auth.uid()
    )
  )
);