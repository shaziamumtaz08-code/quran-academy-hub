DROP POLICY IF EXISTS "Teachers can view zoom licenses" ON public.zoom_licenses;

CREATE POLICY "Teachers can view own class or session licenses"
ON public.zoom_licenses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND (
    EXISTS (
      SELECT 1
      FROM public.course_class_staff ccs
      JOIN public.course_classes cc ON cc.id = ccs.class_id
      WHERE cc.zoom_license_id = zoom_licenses.id
        AND ccs.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      WHERE ls.license_id = zoom_licenses.id
        AND ls.teacher_id = auth.uid()
        AND (ls.status = 'live'
             OR ls.actual_end >= (now() - interval '7 days')
             OR ls.created_at >= (now() - interval '7 days'))
    )
  )
);