CREATE POLICY "Student can save own lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Student can update own lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());