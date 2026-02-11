
-- Fix the student enrollment policy bug (ce.course_id = ce.id should be ce.course_id = courses.id)
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.courses;
CREATE POLICY "Students can view courses they are enrolled in"
ON public.courses FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND
  EXISTS (
    SELECT 1 FROM course_enrollments ce
    WHERE ce.course_id = courses.id
    AND ce.student_id = auth.uid()
    AND ce.status = 'active'
  )
);

-- Fix the recursive policy: Teachers can view course schedules references courses table
-- which in turn checks schedules policies -> infinite loop
-- Replace with a direct teacher_id check via a subquery that bypasses RLS
DROP POLICY IF EXISTS "Teachers can view course schedules" ON public.schedules;
CREATE POLICY "Teachers can view course schedules"
ON public.schedules FOR SELECT
USING (
  course_id IS NOT NULL
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IN (
    SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid()
  )
);
