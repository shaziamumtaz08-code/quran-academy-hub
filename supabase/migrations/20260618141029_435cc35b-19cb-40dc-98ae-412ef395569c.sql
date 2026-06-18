
-- 1) course_lesson_plans: scope teacher SELECT + UPDATE to assigned courses
DROP POLICY IF EXISTS "Teachers can update lesson plan status" ON public.course_lesson_plans;
DROP POLICY IF EXISTS "Teachers can view and update lesson plans" ON public.course_lesson_plans;

CREATE POLICY "Assigned teachers can view lesson plans"
  ON public.course_lesson_plans FOR SELECT TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  );

CREATE POLICY "Assigned teachers can update lesson plans"
  ON public.course_lesson_plans FOR UPDATE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  )
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  );

-- 2) course_notifications: scope teacher ALL to assigned courses
DROP POLICY IF EXISTS "Teachers can manage course notifications" ON public.course_notifications;

CREATE POLICY "Assigned teachers manage course notifications"
  ON public.course_notifications FOR ALL TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  )
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  );

-- 3) course_teacher_guides: scope teacher SELECT to assigned courses
DROP POLICY IF EXISTS "Teachers can view teacher guides" ON public.course_teacher_guides;

CREATE POLICY "Assigned teachers view teacher guides"
  ON public.course_teacher_guides FOR SELECT TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR public.is_course_staff(auth.uid(), course_id)
  );

-- 4) course_teacher_guide_versions: scope via parent guide's course
DROP POLICY IF EXISTS "Teachers can view guide versions" ON public.course_teacher_guide_versions;

CREATE POLICY "Assigned teachers view guide versions"
  ON public.course_teacher_guide_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_teacher_guides g
      WHERE g.id = course_teacher_guide_versions.guide_id
        AND (
          g.course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
          OR public.is_course_staff(auth.uid(), g.course_id)
        )
    )
  );

-- 5) teaching_exam_questions: remove blanket teacher role read; scope via exam.course_id
DROP POLICY IF EXISTS "Scoped view teaching exam questions" ON public.teaching_exam_questions;

CREATE POLICY "Scoped view teaching exam questions"
  ON public.teaching_exam_questions FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'examiner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teaching_exams e
      WHERE e.id = teaching_exam_questions.exam_id
        AND (
          e.created_by = auth.uid()
          OR (
            e.course_id IS NOT NULL AND (
              e.course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
              OR public.is_course_staff(auth.uid(), e.course_id)
            )
          )
        )
    )
  );

-- 6) minor_credentials: prevent students/parents from reading pin_hash/pin_salt via column-level revoke.
--    Admin/backend code uses service_role and is unaffected.
REVOKE SELECT (pin_hash, pin_salt) ON public.minor_credentials FROM authenticated;
REVOKE SELECT (pin_hash, pin_salt) ON public.minor_credentials FROM anon;

-- 7) quiz_sessions: drop the anon-readable policy that exposes access_token
DROP POLICY IF EXISTS "Anon read public live sessions" ON public.quiz_sessions;
