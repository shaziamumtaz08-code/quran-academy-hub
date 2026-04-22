BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view academy reports" ON public.academy_reports;
CREATE POLICY "Admins can view academy reports"
ON public.academy_reports
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view analytics snapshots" ON public.analytics_snapshots;
CREATE POLICY "Students or admins can view analytics snapshots"
ON public.analytics_snapshots
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can update analytics snapshots" ON public.analytics_snapshots;
CREATE POLICY "Students or admins can update analytics snapshots"
ON public.analytics_snapshots
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated view assessment insights" ON public.assessment_insights;
CREATE POLICY "Admins can view assessment insights"
ON public.assessment_insights
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view at-risk flags" ON public.at_risk_flags;
CREATE POLICY "Admins and assigned teachers can view at-risk flags"
ON public.at_risk_flags
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update at-risk flags" ON public.at_risk_flags;
CREATE POLICY "Admins and assigned teachers can update at-risk flags"
ON public.at_risk_flags
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can view outlines" ON public.course_outlines;
CREATE POLICY "Course managers can view outlines"
ON public.course_outlines
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR public.can_manage_course_content(course_id)
);

DROP POLICY IF EXISTS "Authenticated users can update outlines" ON public.course_outlines;
CREATE POLICY "Course managers can update outlines"
ON public.course_outlines
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR public.can_manage_course_content(course_id)
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR public.can_manage_course_content(course_id)
);

DROP POLICY IF EXISTS "Anyone can view org auth config" ON public.org_auth_config;
CREATE POLICY "Admins can view org auth config"
ON public.org_auth_config
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated can view signals" ON public.student_signals;
CREATE POLICY "Students teachers and admins can view signals"
ON public.student_signals
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = student_signals.student_id
      AND sta.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated can view reschedule history" ON public.session_reschedules;
CREATE POLICY "Participants and admins can view reschedule history"
ON public.session_reschedules
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR teacher_id = auth.uid()
  OR student_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can manage flashcard progress" ON public.flashcard_progress;
CREATE POLICY "Students and admins can manage flashcard progress"
ON public.flashcard_progress
FOR ALL TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR student_id = auth.uid()
);

COMMIT;