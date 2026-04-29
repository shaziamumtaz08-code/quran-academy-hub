-- Phase C: tighten teacher UPDATE RLS on attendance to prevent re-pointing rows
-- to students outside the teacher's assignments. Use EXISTS instead of ANY(setof)
-- because Postgres disallows set-returning functions in policy expressions.
DROP POLICY IF EXISTS "Teachers can update their attendance records" ON public.attendance;

CREATE POLICY "Teachers can update their attendance records"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND teacher_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments sta
    WHERE sta.teacher_id = auth.uid()
      AND sta.student_id = attendance.student_id
  )
);