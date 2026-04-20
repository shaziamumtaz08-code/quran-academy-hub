DROP POLICY IF EXISTS "Teachers can view historical student profiles" ON public.profiles;
CREATE POLICY "Teachers can view historical student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND id IN (
    SELECT DISTINCT sta.student_id
    FROM public.student_teacher_assignments sta
    WHERE sta.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can view historical student exams" ON public.exams;
CREATE POLICY "Teachers can view historical student exams"
ON public.exams
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND student_id IN (
    SELECT DISTINCT sta.student_id
    FROM public.student_teacher_assignments sta
    WHERE sta.teacher_id = auth.uid()
  )
);