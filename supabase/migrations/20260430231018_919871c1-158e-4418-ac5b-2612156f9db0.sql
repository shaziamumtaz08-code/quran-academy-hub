-- =========================================================================
-- TEACHER PHASE 2 — RLS HARDENING
-- Closes 3 critical leaks, adds missing teacher policies, tightens scoping
-- All new policies are PERMISSIVE; only over-broad teacher policies dropped.
-- =========================================================================

-- ============= 1A. course_assignments — DROP overly broad + REPLACE =====
DROP POLICY IF EXISTS "Teachers can manage their course assignments" ON public.course_assignments;

CREATE POLICY "teacher_can_select_course_assignments"
ON public.course_assignments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (
      SELECT cc.course_id FROM public.course_classes cc
      JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
      WHERE ccs.user_id = auth.uid()
    )
  )
);

CREATE POLICY "teacher_can_insert_course_assignments"
ON public.course_assignments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (
      SELECT cc.course_id FROM public.course_classes cc
      JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
      WHERE ccs.user_id = auth.uid()
    )
  )
);

CREATE POLICY "teacher_can_update_course_assignments"
ON public.course_assignments FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (
      SELECT cc.course_id FROM public.course_classes cc
      JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
      WHERE ccs.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (
      SELECT cc.course_id FROM public.course_classes cc
      JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
      WHERE ccs.user_id = auth.uid()
    )
  )
);

CREATE POLICY "teacher_can_delete_course_assignments"
ON public.course_assignments FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
);

-- ============= 1B. course_assignment_submissions — DROP + REPLACE =======
DROP POLICY IF EXISTS "Teachers can view and update submissions" ON public.course_assignment_submissions;

CREATE POLICY "teacher_can_select_assignment_submissions"
ON public.course_assignment_submissions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND assignment_id IN (
    SELECT id FROM public.course_assignments WHERE
      course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
      OR course_id IN (
        SELECT cc.course_id FROM public.course_classes cc
        JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
        WHERE ccs.user_id = auth.uid()
      )
  )
);

CREATE POLICY "teacher_can_update_assignment_submissions"
ON public.course_assignment_submissions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND assignment_id IN (
    SELECT id FROM public.course_assignments WHERE
      course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
      OR course_id IN (
        SELECT cc.course_id FROM public.course_classes cc
        JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
        WHERE ccs.user_id = auth.uid()
      )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
);

-- ============= 1C. course_quizzes — DROP USING(true) + REPLACE ==========
DROP POLICY IF EXISTS "Authenticated users can view published quizzes" ON public.course_quizzes;

CREATE POLICY "teacher_can_select_course_quizzes"
ON public.course_quizzes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (
      SELECT cc.course_id FROM public.course_classes cc
      JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
      WHERE ccs.user_id = auth.uid()
    )
  )
);

-- Add scoped student SELECT for enrolled students (replaces the dropped public read)
CREATE POLICY "student_can_select_published_course_quizzes"
ON public.course_quizzes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND course_id IN (SELECT get_student_enrolled_course_ids(auth.uid()))
);

-- ============= 2D. course_quiz_attempts — teacher SELECT ================
CREATE POLICY "teacher_can_select_quiz_attempts"
ON public.course_quiz_attempts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND quiz_id IN (
    SELECT id FROM public.course_quizzes WHERE
      course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
      OR course_id IN (
        SELECT cc.course_id FROM public.course_classes cc
        JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
        WHERE ccs.user_id = auth.uid()
      )
  )
);

-- Teacher UPDATE for grading
CREATE POLICY "teacher_can_update_quiz_attempts"
ON public.course_quiz_attempts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND quiz_id IN (
    SELECT id FROM public.course_quizzes WHERE
      course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
      OR course_id IN (
        SELECT cc.course_id FROM public.course_classes cc
        JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
        WHERE ccs.user_id = auth.uid()
      )
  )
)
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- ============= 2E. course_class_students — teacher SELECT ===============
CREATE POLICY "teacher_can_select_course_class_students"
ON public.course_class_students FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND class_id IN (
    SELECT class_id FROM public.course_class_staff WHERE user_id = auth.uid()
  )
);

-- ============= 2F. student_reports — TABLE NOT FOUND, skipped ===========
-- Note: public.student_reports does not exist in this schema. No-op.

-- ============= 3. Group co-teacher attendance INSERT (additive) =========
CREATE POLICY "co_teacher_can_insert_group_attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND teacher_id = auth.uid()
  AND course_id IS NOT NULL
  AND course_id IN (
    SELECT cc.course_id FROM public.course_classes cc
    JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
    WHERE ccs.user_id = auth.uid()
  )
);

-- Group co-teacher SELECT for attendance (mirror)
CREATE POLICY "co_teacher_can_select_group_attendance"
ON public.attendance FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IS NOT NULL
  AND course_id IN (
    SELECT cc.course_id FROM public.course_classes cc
    JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
    WHERE ccs.user_id = auth.uid()
  )
);

-- ============= 4G. course_lessons UPDATE — add WITH CHECK ===============
DROP POLICY IF EXISTS "Teachers can update own course lessons" ON public.course_lessons;

CREATE POLICY "teacher_can_update_course_lessons"
ON public.course_lessons FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
);

-- ============= 4H. chat_messages INSERT — recreate with explicit WITH CHECK
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY "members_can_send_messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND group_id IN (SELECT group_id FROM public.chat_members WHERE user_id = auth.uid())
);

-- ============= 4I. live_sessions — already has WITH CHECK, no-op =======

-- ============= 5. Tighten get_teacher_student_ids to active only ========
CREATE OR REPLACE FUNCTION public.get_teacher_student_ids(_teacher_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM public.student_teacher_assignments
  WHERE teacher_id = _teacher_id AND status = 'active';
$$;
