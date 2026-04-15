
-- Assignment grades column
ALTER TABLE public.course_assignment_submissions
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT NULL;

-- RLS: Students can view their class's chat group
CREATE POLICY "Students view their class chat groups"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM public.course_class_students WHERE student_id = auth.uid()
    )
  );

-- RLS: Teachers view chat groups for their classes
CREATE POLICY "Teachers view their class chat groups"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM public.course_class_staff WHERE user_id = auth.uid()
    )
  );
