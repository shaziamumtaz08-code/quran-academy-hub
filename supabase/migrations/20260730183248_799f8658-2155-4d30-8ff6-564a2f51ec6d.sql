
-- Helper: can the current user manage a given session plan's content kit?
CREATE OR REPLACE FUNCTION public.can_manage_session_plan(_session_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_plans sp
    JOIN public.syllabi s ON s.id = sp.syllabus_id
    WHERE sp.id = _session_plan_id
      AND (
        s.user_id = auth.uid()
        OR (s.course_id IS NOT NULL AND public.can_manage_course_content(s.course_id))
      )
  )
$$;

-- 1) Storage: scope content-kit uploads
DROP POLICY IF EXISTS "Teachers can upload course materials" ON storage.objects;
CREATE POLICY "Teachers can upload course materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.has_role(auth.uid(), 'teacher'::app_role)
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] = ANY (ARRAY['assignments','announcements','submissions'])
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'content-kit'
      AND (storage.foldername(name))[2] IS NOT NULL
      AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
      AND public.can_manage_session_plan(((storage.foldername(name))[2])::uuid)
    )
    OR EXISTS (
      SELECT 1
      FROM public.course_class_staff ccs
      JOIN public.course_classes cc ON cc.id = ccs.class_id
      WHERE cc.course_id::text = (storage.foldername(name))[1]
        AND ccs.user_id = auth.uid()
    )
  )
);

-- 2) Exam field results: scope to the exam's examiner / the student's teacher
DROP POLICY IF EXISTS "Staff can view all results" ON public.exam_field_results;
CREATE POLICY "Staff can view scoped results"
ON public.exam_field_results FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_field_results.exam_id
      AND (
        e.examiner_id = auth.uid()
        OR (
          public.has_role(auth.uid(), 'teacher'::app_role)
          AND EXISTS (
            SELECT 1 FROM public.student_teacher_assignments sta
            WHERE sta.teacher_id = auth.uid() AND sta.student_id = e.student_id
          )
        )
      )
  )
);

-- 3) Exam templates + fields: staff see active templates or their own
DROP POLICY IF EXISTS "Staff can view templates" ON public.exam_templates;
CREATE POLICY "Staff can view active templates"
ON public.exam_templates FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR created_by = auth.uid()
  OR (
    is_active = true
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'examiner'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Staff can view all template fields" ON public.exam_template_fields;
CREATE POLICY "Staff can view fields of active templates"
ON public.exam_template_fields FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.exam_templates t
    WHERE t.id = exam_template_fields.template_id
      AND (
        t.created_by = auth.uid()
        OR (
          t.is_active = true
          AND (
            public.has_role(auth.uid(), 'teacher'::app_role)
            OR public.has_role(auth.uid(), 'examiner'::app_role)
          )
        )
      )
  )
);

-- 4) Teaching exam questions: remove blanket examiner-wide visibility
DROP POLICY IF EXISTS "Scoped view teaching exam questions" ON public.teaching_exam_questions;
CREATE POLICY "Scoped view teaching exam questions"
ON public.teaching_exam_questions FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.teaching_exams e
    WHERE e.id = teaching_exam_questions.exam_id
      AND (
        e.created_by = auth.uid()
        OR (
          e.course_id IS NOT NULL
          AND (
            e.course_id IN (SELECT c.id FROM public.courses c WHERE c.teacher_id = auth.uid())
            OR public.is_course_staff(auth.uid(), e.course_id)
          )
        )
      )
  )
);
