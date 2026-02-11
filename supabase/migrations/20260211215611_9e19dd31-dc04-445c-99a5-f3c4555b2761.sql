-- Fix the circular recursion: courses ↔ course_enrollments

-- Drop the recursive teacher enrollment policy
DROP POLICY IF EXISTS "Teachers can view enrollments for their courses" ON public.course_enrollments;

-- Recreate using a direct column check instead of subquerying courses
CREATE POLICY "Teachers can view enrollments for their courses" ON public.course_enrollments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_enrollments.course_id AND c.teacher_id = auth.uid()
  )
);

-- The issue is that courses RLS for students uses course_enrollments, and course_enrollments for teachers uses courses
-- We need to break one side. Let's use a SECURITY DEFINER function for the student enrollment check.

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_student_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE student_id = _student_id AND course_id = _course_id AND status = 'active'
  )
$$;

-- Now update the courses student policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.courses;

CREATE POLICY "Students can view courses they are enrolled in" ON public.courses
FOR SELECT USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_enrolled_in_course(auth.uid(), id)
);