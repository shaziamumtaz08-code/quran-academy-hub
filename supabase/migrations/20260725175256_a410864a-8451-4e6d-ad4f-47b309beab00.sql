DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.courses;
CREATE POLICY "Students can view courses they are enrolled in"
ON public.courses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'student'::app_role) AND is_enrolled_in_course(auth.uid(), id));