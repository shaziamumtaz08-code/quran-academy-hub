-- Allow students to read their own roster row, their class details, their classmates and staff,
-- and lesson plans for courses they are enrolled in.

-- 1) course_class_students: students see their own row
CREATE POLICY "Students can view own roster"
ON public.course_class_students
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- 1b) course_class_students: students see classmates in same class
CREATE POLICY "Students can view classmates"
ON public.course_class_students
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_class_students me
    WHERE me.student_id = auth.uid() AND me.class_id = course_class_students.class_id
  )
);

-- 2) course_classes: students see classes they belong to
CREATE POLICY "Students can view their classes"
ON public.course_classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_class_students ccs
    WHERE ccs.class_id = course_classes.id AND ccs.student_id = auth.uid()
  )
  OR public.is_enrolled_in_course(auth.uid(), course_classes.course_id)
);

-- 2b) course_classes: teachers/staff see classes they staff
CREATE POLICY "Staff can view their classes"
ON public.course_classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_class_staff ccs
    WHERE ccs.class_id = course_classes.id AND ccs.user_id = auth.uid()
  )
);

-- 3) course_class_staff: students see staff for their class
CREATE POLICY "Students can view class staff"
ON public.course_class_staff
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_class_students ccs
    WHERE ccs.class_id = course_class_staff.class_id AND ccs.student_id = auth.uid()
  )
);

-- 4) course_lesson_plans: enrolled students can view
CREATE POLICY "Enrolled students can view lesson plans"
ON public.course_lesson_plans
FOR SELECT
TO authenticated
USING (public.is_enrolled_in_course(auth.uid(), course_id));