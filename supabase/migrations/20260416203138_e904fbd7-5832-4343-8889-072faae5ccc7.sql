-- Helper: do user A and user B share at least one active class?
CREATE OR REPLACE FUNCTION public.share_a_class(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_class_students a
    JOIN public.course_class_students b ON a.class_id = b.class_id
    WHERE a.student_id = _user_a
      AND b.student_id = _user_b
      AND a.status = 'active'
      AND b.status = 'active'
  );
$$;

-- Allow students to view classmate profiles (basic info read via RLS-restricted view in app)
CREATE POLICY "Students can view classmate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND public.share_a_class(auth.uid(), id)
);