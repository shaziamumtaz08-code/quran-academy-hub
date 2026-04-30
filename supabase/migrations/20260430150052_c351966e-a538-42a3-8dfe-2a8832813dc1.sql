
-- =========================================================
-- STUDENT PHASE 2 — Tier 2 RLS (28 PERMISSIVE student SELECT policies)
-- Additive only. No drops, no alters of existing policies.
-- =========================================================

-- ---------- HELPER FUNCTIONS ----------
CREATE OR REPLACE FUNCTION public.get_student_enrolled_course_ids(_student_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT course_id FROM course_enrollments
  WHERE student_id = _student_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_student_class_ids(_student_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM course_class_students
  WHERE student_id = _student_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_student_active_assignment_ids(_student_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM student_teacher_assignments
  WHERE student_id = _student_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_student_division_ids(_student_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT division_id FROM student_teacher_assignments
  WHERE student_id = _student_id AND division_id IS NOT NULL
  UNION
  SELECT DISTINCT c.division_id FROM course_enrollments ce
  JOIN courses c ON c.id = ce.course_id
  WHERE ce.student_id = _student_id AND c.division_id IS NOT NULL;
$$;

-- ---------- 1. course_enrollments ----------
CREATE POLICY "student_can_select_course_enrollments"
ON public.course_enrollments AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 2. course_classes ----------
CREATE POLICY "student_can_select_course_classes"
ON public.course_classes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND (
    course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
    OR id IN (SELECT public.get_student_class_ids(auth.uid()))
  )
);

-- ---------- 3. course_class_students ----------
CREATE POLICY "student_can_select_course_class_students"
ON public.course_class_students AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 4. course_modules ----------
CREATE POLICY "student_can_select_course_modules"
ON public.course_modules AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 5. course_lessons ----------
CREATE POLICY "student_can_select_course_lessons"
ON public.course_lessons AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 6. course_assignments ----------
CREATE POLICY "student_can_select_course_assignments"
ON public.course_assignments AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 7. course_assignment_submissions ----------
CREATE POLICY "student_can_select_course_assignment_submissions"
ON public.course_assignment_submissions AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 8. course_certificate_awards (substitutes student_certificates) ----------
CREATE POLICY "student_can_select_course_certificate_awards"
ON public.course_certificate_awards AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 9. course_certificates (templates for enrolled courses) ----------
CREATE POLICY "student_can_select_course_certificates"
ON public.course_certificates AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 10. attendance ----------
CREATE POLICY "student_can_select_attendance"
ON public.attendance AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 11. fee_invoices ----------
CREATE POLICY "student_can_select_fee_invoices"
ON public.fee_invoices AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 12. schedules ----------
CREATE POLICY "student_can_select_schedules"
ON public.schedules AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND assignment_id IN (SELECT public.get_student_active_assignment_ids(auth.uid()))
);

-- ---------- 13. student_teacher_assignments ----------
CREATE POLICY "student_can_select_student_teacher_assignments"
ON public.student_teacher_assignments AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 14. chat_groups ----------
CREATE POLICY "student_can_select_chat_groups"
ON public.chat_groups AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND id IN (SELECT group_id FROM chat_members WHERE user_id = auth.uid())
);

-- ---------- 15. chat_members ----------
CREATE POLICY "student_can_select_chat_members"
ON public.chat_members AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND (
    user_id = auth.uid()
    OR group_id IN (SELECT group_id FROM chat_members WHERE user_id = auth.uid())
  )
);

-- ---------- 16. chat_messages ----------
CREATE POLICY "student_can_select_chat_messages"
ON public.chat_messages AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND group_id IN (SELECT group_id FROM chat_members WHERE user_id = auth.uid())
);

-- ---------- 17. notification_queue ----------
CREATE POLICY "student_can_select_notification_queue"
ON public.notification_queue AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND recipient_id = auth.uid());

-- ---------- 18. resources (via resource_assignments) ----------
CREATE POLICY "student_can_select_resources"
ON public.resources AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND id IN (
    SELECT resource_id FROM resource_assignments
    WHERE assigned_to = auth.uid()
       OR course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
  )
);

-- ---------- 19. live_sessions ----------
CREATE POLICY "student_can_select_live_sessions"
ON public.live_sessions AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND (
    student_id = auth.uid()
    OR assignment_id IN (SELECT public.get_student_active_assignment_ids(auth.uid()))
    OR group_id IN (SELECT group_id FROM chat_members WHERE user_id = auth.uid())
  )
);

-- ---------- 20. content_kits ----------
CREATE POLICY "student_can_select_content_kits"
ON public.content_kits AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 21. course_quiz_attempts ----------
CREATE POLICY "student_can_select_course_quiz_attempts"
ON public.course_quiz_attempts AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 22. flashcard_progress (substitutes course_flashcard_progress) ----------
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_can_select_flashcard_progress"
ON public.flashcard_progress AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND student_id = auth.uid());

-- ---------- 23. quiz_questions (linked via content_kits.course_id) ----------
CREATE POLICY "student_can_select_quiz_questions"
ON public.quiz_questions AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND kit_id IN (
    SELECT id FROM content_kits
    WHERE course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
  )
);

-- ---------- 24. session_plans (via syllabi.course_id) ----------
CREATE POLICY "student_can_select_session_plans"
ON public.session_plans AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND syllabus_id IN (
    SELECT id FROM syllabi
    WHERE course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
  )
);

-- ---------- 25. syllabi ----------
CREATE POLICY "student_can_select_syllabi"
ON public.syllabi AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND course_id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);

-- ---------- 26. divisions ----------
CREATE POLICY "student_can_select_divisions"
ON public.divisions AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND id IN (SELECT public.get_student_division_ids(auth.uid()))
);

-- ---------- 27. user_context ----------
CREATE POLICY "student_can_select_user_context"
ON public.user_context AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(),'student'::app_role) AND user_id = auth.uid());

-- ---------- 28. courses (read enrolled course meta) ----------
CREATE POLICY "student_can_select_courses"
ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'student'::app_role)
  AND id IN (SELECT public.get_student_enrolled_course_ids(auth.uid()))
);
