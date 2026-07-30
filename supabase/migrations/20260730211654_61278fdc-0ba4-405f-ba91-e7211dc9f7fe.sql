DROP POLICY IF EXISTS teacher_can_update_assignment_submissions ON public.course_assignment_submissions;
CREATE POLICY teacher_can_update_assignment_submissions
ON public.course_assignment_submissions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND assignment_id IN (
    SELECT ca.id FROM course_assignments ca
    WHERE ca.course_id IN (SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid())
       OR ca.course_id IN (SELECT cc.course_id FROM course_classes cc JOIN course_class_staff ccs ON ccs.class_id = cc.id WHERE ccs.user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND assignment_id IN (
    SELECT ca.id FROM course_assignments ca
    WHERE ca.course_id IN (SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid())
       OR ca.course_id IN (SELECT cc.course_id FROM course_classes cc JOIN course_class_staff ccs ON ccs.class_id = cc.id WHERE ccs.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS teacher_can_update_quiz_attempts ON public.course_quiz_attempts;
CREATE POLICY teacher_can_update_quiz_attempts
ON public.course_quiz_attempts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND quiz_id IN (
    SELECT q.id FROM course_quizzes q
    WHERE q.course_id IN (SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid())
       OR q.course_id IN (SELECT cc.course_id FROM course_classes cc JOIN course_class_staff ccs ON ccs.class_id = cc.id WHERE ccs.user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND quiz_id IN (
    SELECT q.id FROM course_quizzes q
    WHERE q.course_id IN (SELECT c.id FROM courses c WHERE c.teacher_id = auth.uid())
       OR q.course_id IN (SELECT cc.course_id FROM course_classes cc JOIN course_class_staff ccs ON ccs.class_id = cc.id WHERE ccs.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Examiner can insert results" ON public.exam_field_results;
CREATE POLICY "Examiner can insert results"
ON public.exam_field_results FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'examiner'::app_role)
  AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_field_results.exam_id AND e.examiner_id = auth.uid())
);