
-- 1) Add unique constraint on course_enrollments (course_id, student_id)
ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_course_student_unique UNIQUE (course_id, student_id);

-- 2) Make assignment_id nullable on schedules (currently NOT NULL)
ALTER TABLE public.schedules
  ALTER COLUMN assignment_id DROP NOT NULL;

-- 3) Add course_id column to schedules
ALTER TABLE public.schedules
  ADD COLUMN course_id uuid NULL REFERENCES public.courses(id);

-- 4) XOR check: exactly one of assignment_id or course_id must be set
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_xor_assignment_course
  CHECK (
    (assignment_id IS NOT NULL AND course_id IS NULL)
    OR
    (assignment_id IS NULL AND course_id IS NOT NULL)
  );

-- 5) RLS policy: Admins can manage course schedules
CREATE POLICY "Admin can manage course schedules"
  ON public.schedules
  FOR ALL
  USING (
    course_id IS NOT NULL
    AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  );

-- 6) Teachers can view their course schedules
CREATE POLICY "Teachers can view course schedules"
  ON public.schedules
  FOR SELECT
  USING (
    course_id IS NOT NULL
    AND has_role(auth.uid(), 'teacher'::app_role)
    AND EXISTS (
      SELECT 1 FROM courses c WHERE c.id = schedules.course_id AND c.teacher_id = auth.uid()
    )
  );
