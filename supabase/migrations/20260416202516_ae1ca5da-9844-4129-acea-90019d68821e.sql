-- Drop the recursive policy
DROP POLICY IF EXISTS "Students can view classmates" ON public.course_class_students;

-- Helper: is this user a student in the given class? (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_student_in_class(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_class_students
    WHERE class_id = _class_id AND student_id = _user_id
  )
$$;

-- Re-add classmates policy using the helper (no recursion)
CREATE POLICY "Students can view classmates"
ON public.course_class_students
FOR SELECT
TO authenticated
USING (public.is_student_in_class(auth.uid(), class_id));

-- Also fix the course_classes "Students can view their classes" policy that uses subquery on course_class_students
DROP POLICY IF EXISTS "Students can view their classes" ON public.course_classes;
CREATE POLICY "Students can view their classes"
ON public.course_classes
FOR SELECT
TO authenticated
USING (
  public.is_student_in_class(auth.uid(), id)
  OR public.is_enrolled_in_course(auth.uid(), course_id)
);

-- Same for course_class_staff "Students can view class staff"
DROP POLICY IF EXISTS "Students can view class staff" ON public.course_class_staff;
CREATE POLICY "Students can view class staff"
ON public.course_class_staff
FOR SELECT
TO authenticated
USING (public.is_student_in_class(auth.uid(), class_id));