
-- Helper function: check if user is staff (teacher/moderator) on any class in a course
CREATE OR REPLACE FUNCTION public.is_course_staff(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_class_staff ccs
    JOIN public.course_classes cc ON cc.id = ccs.class_id
    WHERE ccs.user_id = _user_id
      AND cc.course_id = _course_id
  )
$$;

-- Fix courses: let class-level staff (teacher/moderator) view their assigned courses
DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;
CREATE POLICY "Staff can view assigned courses"
ON public.courses
FOR SELECT
TO authenticated
USING (
  -- Legacy teacher_id field
  (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid())
  OR
  -- Class-level staff (teacher or moderator)
  is_course_staff(auth.uid(), id)
);

-- Fix syllabi: let course staff view syllabi for their courses
DROP POLICY IF EXISTS "Users can view own syllabi" ON public.syllabi;
CREATE POLICY "Users can view accessible syllabi"
ON public.syllabi
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR (course_id IS NOT NULL AND is_course_staff(auth.uid(), course_id))
);

-- Fix session_plans: let course staff view session plans for accessible syllabi
DROP POLICY IF EXISTS "Users can view own session plans" ON public.session_plans;
CREATE POLICY "Users can view accessible session plans"
ON public.session_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM syllabi s
    WHERE s.id = session_plans.syllabus_id
      AND (
        s.user_id = auth.uid()
        OR is_admin(auth.uid())
        OR is_super_admin(auth.uid())
        OR (s.course_id IS NOT NULL AND is_course_staff(auth.uid(), s.course_id))
      )
  )
);

-- Also let course_class_staff be viewable by staff themselves (teachers see their own assignments)
DROP POLICY IF EXISTS "Staff can view own assignments" ON public.course_class_staff;
CREATE POLICY "Staff can view own assignments"
ON public.course_class_staff
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);
