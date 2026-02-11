-- Fix infinite recursion: Replace the course-referencing schedule policies with direct checks

-- Drop the problematic policies
DROP POLICY IF EXISTS "Teachers can view course schedules" ON public.schedules;
DROP POLICY IF EXISTS "Admin can manage course schedules" ON public.schedules;

-- Recreate without recursion: use teacher_id from courses directly via subquery that won't trigger courses RLS
CREATE POLICY "Teachers can view course schedules" ON public.schedules
FOR SELECT USING (
  course_id IS NOT NULL
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = schedules.course_id AND c.teacher_id = auth.uid()
  )
);

-- Admin course schedules - simplified to avoid recursion
CREATE POLICY "Admin can manage course schedules" ON public.schedules
FOR ALL USING (
  course_id IS NOT NULL
  AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
);

-- Also fix courses table policies that may cause recursion with schedules
-- Drop and recreate the student enrollment policy to use SECURITY DEFINER function
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.courses;

CREATE POLICY "Students can view courses they are enrolled in" ON public.courses
FOR SELECT USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (
    SELECT ce.course_id FROM public.course_enrollments ce
    WHERE ce.student_id = auth.uid() AND ce.status = 'active'
  )
);

-- Drop and recreate teacher view policy to avoid recursion
DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;

CREATE POLICY "Teachers can view their courses" ON public.courses
FOR SELECT USING (
  has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid()
);