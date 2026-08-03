DROP POLICY IF EXISTS "Teacher can manage own course quiz questions" ON public.course_quiz_questions;
CREATE POLICY "Teacher can manage own course quiz questions"
ON public.course_quiz_questions
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND quiz_id IN (SELECT id FROM public.course_quizzes WHERE created_by = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND quiz_id IN (SELECT id FROM public.course_quizzes WHERE created_by = auth.uid())
);