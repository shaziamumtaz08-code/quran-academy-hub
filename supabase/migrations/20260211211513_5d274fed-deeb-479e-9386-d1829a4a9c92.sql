
-- Fix infinite recursion: attendance policy references courses table directly
DROP POLICY IF EXISTS "Teachers can view group attendance" ON public.attendance;
CREATE POLICY "Teachers can view group attendance"
ON public.attendance FOR SELECT
USING (
  course_id IS NOT NULL
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IN (
    SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid()
  )
);
