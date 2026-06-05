
-- =========================================================================
-- course_outlines: restrict INSERT to course managers / admins
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can create outlines" ON public.course_outlines;
CREATE POLICY "Course managers can create outlines"
  ON public.course_outlines FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.can_manage_course_content(course_id)
  );

-- =========================================================================
-- drill_phrases: remove blanket authenticated mutations
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated insert drill phrases" ON public.drill_phrases;
DROP POLICY IF EXISTS "Authenticated update drill phrases" ON public.drill_phrases;
DROP POLICY IF EXISTS "Authenticated delete drill phrases" ON public.drill_phrases;
-- existing "Authenticated view drill phrases" + "Teacher can manage own drill_phrases" + admin policies retained
-- view stays open because drill content itself is non-sensitive lesson material

-- =========================================================================
-- playlist_videos: remove blanket authenticated mutations
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated insert playlist videos" ON public.playlist_videos;
DROP POLICY IF EXISTS "Authenticated update playlist videos" ON public.playlist_videos;
DROP POLICY IF EXISTS "Authenticated delete playlist videos" ON public.playlist_videos;
-- "Authenticated view playlist videos" retained — videos are general lesson content

-- =========================================================================
-- session_playlists: remove blanket insert
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated insert session playlists" ON public.session_playlists;
CREATE POLICY "Teachers and admins insert session playlists"
  ON public.session_playlists FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

-- =========================================================================
-- speaking_drills / speaking_assignments: remove blanket insert + tighten view
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated insert speaking drills" ON public.speaking_drills;
CREATE POLICY "Teachers and admins insert speaking drills"
  ON public.speaking_drills FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated insert assignments" ON public.speaking_assignments;
CREATE POLICY "Teachers and admins insert speaking assignments"
  ON public.speaking_assignments FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

-- =========================================================================
-- teaching_exams / teaching_exam_questions: stop exposing every exam to every user
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated view teaching exams" ON public.teaching_exams;
CREATE POLICY "Scoped view teaching exams"
  ON public.teaching_exams FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'teacher'::app_role)
    OR public.has_role(auth.uid(), 'examiner'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated view teaching exam questions" ON public.teaching_exam_questions;
CREATE POLICY "Scoped view teaching exam questions"
  ON public.teaching_exam_questions FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'examiner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teaching_exams e
      WHERE e.id = teaching_exam_questions.exam_id
        AND (e.created_by = auth.uid() OR public.has_role(auth.uid(), 'teacher'::app_role))
    )
  );

-- =========================================================================
-- virtual_sessions: only the creator (or admin) can manage; OR-has_role removed
-- =========================================================================
DROP POLICY IF EXISTS "Teachers manage own sessions" ON public.virtual_sessions;
CREATE POLICY "Creators manage virtual sessions"
  ON public.virtual_sessions FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- =========================================================================
-- organization_payment_accounts: restrict read to admins
-- =========================================================================
DROP POLICY IF EXISTS "opa_select_authed" ON public.organization_payment_accounts;
CREATE POLICY "opa_select_admin"
  ON public.organization_payment_accounts FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- =========================================================================
-- profile_payment_account_history: insert must be account owner or admin
-- =========================================================================
DROP POLICY IF EXISTS "ppah_insert_any_authed" ON public.profile_payment_account_history;
CREATE POLICY "ppah_insert_owner_or_admin"
  ON public.profile_payment_account_history FOR INSERT
  WITH CHECK (
    auth.uid() = profile_id
    OR public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- =========================================================================
-- minor_credentials: parents can write but not read pin_hash
-- =========================================================================
DROP POLICY IF EXISTS "Parents can manage child credentials" ON public.minor_credentials;
CREATE POLICY "Parents can create child credentials"
  ON public.minor_credentials FOR INSERT
  WITH CHECK (profile_id IN (SELECT public.get_parent_children_ids(auth.uid())));
CREATE POLICY "Parents can update child credentials"
  ON public.minor_credentials FOR UPDATE
  USING (profile_id IN (SELECT public.get_parent_children_ids(auth.uid())))
  WITH CHECK (profile_id IN (SELECT public.get_parent_children_ids(auth.uid())));
CREATE POLICY "Parents can delete child credentials"
  ON public.minor_credentials FOR DELETE
  USING (profile_id IN (SELECT public.get_parent_children_ids(auth.uid())));
-- NOTE: no SELECT policy for parents — pin_hash is no longer readable by them

-- =========================================================================
-- export_audit_logs: drop redundant any-authenticated insert
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can insert export audit logs" ON public.export_audit_logs;
-- Edge functions use service_role and bypass RLS, so no replacement INSERT policy is needed.

-- =========================================================================
-- Storage: reports-exports bucket — restrict read to admins
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated read reports-exports" ON storage.objects;
CREATE POLICY "Admins read reports-exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reports-exports'
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated upload reports-exports" ON storage.objects;
CREATE POLICY "Admins upload reports-exports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reports-exports'
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );
