DROP POLICY IF EXISTS "View segments of visible attendance" ON public.attendance_lesson_segments;

CREATE POLICY "View segments of visible attendance"
ON public.attendance_lesson_segments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.id = attendance_lesson_segments.attendance_id
      AND (
        a.teacher_id = auth.uid()
        OR a.created_by = auth.uid()
        OR a.student_id = auth.uid()
        OR a.student_id IN (SELECT public.get_parent_children_ids(auth.uid()))
        OR public.is_admin(auth.uid())
        OR public.is_super_admin(auth.uid())
      )
  )
);