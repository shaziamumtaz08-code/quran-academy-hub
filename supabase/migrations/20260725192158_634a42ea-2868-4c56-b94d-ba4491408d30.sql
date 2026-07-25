-- ── Helper: teaching staff check ────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_teaching_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_admin(_uid) OR public.is_super_admin(_uid)
    OR public.has_role(_uid, 'teacher'::app_role)
    OR public.has_role(_uid, 'examiner'::app_role)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_teaching_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teaching_staff(uuid) TO authenticated, service_role;

-- ── 1. poll_responses: vote privacy ─────────────────────────────
DROP POLICY IF EXISTS "Users can view poll responses" ON public.poll_responses;
CREATE POLICY "Users view own vote or own poll" ON public.poll_responses
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin(auth.uid()) OR is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_responses.poll_id AND p.created_by = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_poll_option_counts(_poll_ids uuid[])
RETURNS TABLE(option_id uuid, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.option_id, count(*)::bigint
  FROM public.poll_responses pr
  WHERE auth.uid() IS NOT NULL AND pr.poll_id = ANY(_poll_ids)
  GROUP BY pr.option_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_poll_option_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_poll_option_counts(uuid[]) TO authenticated, service_role;

-- ── 2. organizations: settings admin-only ───────────────────────
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Authenticated view organization basics" ON public.organizations
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.organizations FROM authenticated;
GRANT SELECT (id, name, slug, logo_url, code, created_at, updated_at) ON public.organizations TO authenticated;

-- ── 3. course_certificates ──────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can view certificates" ON public.course_certificates;
CREATE POLICY "Teaching staff view certificates" ON public.course_certificates
  FOR SELECT TO authenticated USING (is_teaching_staff(auth.uid()));

-- ── 3b. Teaching OS content scoping ─────────────────────────────
DROP POLICY IF EXISTS "Authenticated view video library" ON public.video_library;
CREATE POLICY "Scoped view video library" ON public.video_library
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid()) OR added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.playlist_videos pv
      JOIN public.session_playlists sp ON sp.id = pv.playlist_id
      WHERE pv.video_id = video_library.id
        AND sp.course_id IN (SELECT get_student_enrolled_course_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Authenticated view video insights" ON public.video_insights;
CREATE POLICY "Staff view video insights" ON public.video_insights
  FOR SELECT TO authenticated USING (is_teaching_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated view filter settings" ON public.video_filter_settings;
CREATE POLICY "Staff view filter settings" ON public.video_filter_settings
  FOR SELECT TO authenticated USING (is_teaching_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated view session playlists" ON public.session_playlists;
CREATE POLICY "Scoped view session playlists" ON public.session_playlists
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid()) OR created_by = auth.uid()
    OR course_id IN (SELECT get_student_enrolled_course_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated view playlist videos" ON public.playlist_videos;
CREATE POLICY "Scoped view playlist videos" ON public.playlist_videos
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid()) OR added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_playlists sp
      WHERE sp.id = playlist_videos.playlist_id
        AND sp.course_id IN (SELECT get_student_enrolled_course_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Authenticated view speaking drills" ON public.speaking_drills;
CREATE POLICY "Scoped view speaking drills" ON public.speaking_drills
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid()) OR created_by = auth.uid()
    OR course_id IN (SELECT get_student_enrolled_course_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated view drill phrases" ON public.drill_phrases;
CREATE POLICY "Scoped view drill phrases" ON public.drill_phrases
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.speaking_drills sd
      WHERE sd.id = drill_phrases.drill_id
        AND (sd.created_by = auth.uid()
             OR sd.course_id IN (SELECT get_student_enrolled_course_ids(auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Authenticated view assignments" ON public.speaking_assignments;
CREATE POLICY "Scoped view speaking assignments" ON public.speaking_assignments
  FOR SELECT TO authenticated
  USING (
    is_teaching_staff(auth.uid()) OR created_by = auth.uid()
    OR (assigned_to IS NOT NULL AND assigned_to @> to_jsonb(auth.uid()::text))
  );

-- ── 4. content kit family + source_files → authenticated only ───
DROP POLICY IF EXISTS "Authorized users can view content kits" ON public.content_kits;
CREATE POLICY "Authorized users can view content kits" ON public.content_kits
  FOR SELECT TO authenticated USING (can_view_content_kit(id));
DROP POLICY IF EXISTS "Authorized users can update content kits" ON public.content_kits;
CREATE POLICY "Authorized users can update content kits" ON public.content_kits
  FOR UPDATE TO authenticated USING (can_manage_content_kit(id)) WITH CHECK (can_manage_content_kit(id));
DROP POLICY IF EXISTS "Authorized users can delete content kits" ON public.content_kits;
CREATE POLICY "Authorized users can delete content kits" ON public.content_kits
  FOR DELETE TO authenticated USING (can_manage_content_kit(id));

DROP POLICY IF EXISTS "Authorized users can view flashcards" ON public.flashcards;
CREATE POLICY "Authorized users can view flashcards" ON public.flashcards
  FOR SELECT TO authenticated USING (can_view_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can update flashcards" ON public.flashcards;
CREATE POLICY "Authorized users can update flashcards" ON public.flashcards
  FOR UPDATE TO authenticated USING (can_manage_content_kit(kit_id)) WITH CHECK (can_manage_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can delete flashcards" ON public.flashcards;
CREATE POLICY "Authorized users can delete flashcards" ON public.flashcards
  FOR DELETE TO authenticated USING (can_manage_content_kit(kit_id));

DROP POLICY IF EXISTS "Authorized users can view slides" ON public.slides;
CREATE POLICY "Authorized users can view slides" ON public.slides
  FOR SELECT TO authenticated USING (can_view_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can update slides" ON public.slides;
CREATE POLICY "Authorized users can update slides" ON public.slides
  FOR UPDATE TO authenticated USING (can_manage_content_kit(kit_id)) WITH CHECK (can_manage_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can delete slides" ON public.slides;
CREATE POLICY "Authorized users can delete slides" ON public.slides
  FOR DELETE TO authenticated USING (can_manage_content_kit(kit_id));

DROP POLICY IF EXISTS "Authorized users can view worksheets" ON public.worksheets;
CREATE POLICY "Authorized users can view worksheets" ON public.worksheets
  FOR SELECT TO authenticated USING (can_view_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can update worksheets" ON public.worksheets;
CREATE POLICY "Authorized users can update worksheets" ON public.worksheets
  FOR UPDATE TO authenticated USING (can_manage_content_kit(kit_id)) WITH CHECK (can_manage_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can delete worksheets" ON public.worksheets;
CREATE POLICY "Authorized users can delete worksheets" ON public.worksheets
  FOR DELETE TO authenticated USING (can_manage_content_kit(kit_id));

DROP POLICY IF EXISTS "Authorized users can update quiz questions" ON public.quiz_questions;
CREATE POLICY "Authorized users can update quiz questions" ON public.quiz_questions
  FOR UPDATE TO authenticated USING (can_manage_content_kit(kit_id)) WITH CHECK (can_manage_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can delete quiz questions" ON public.quiz_questions;
CREATE POLICY "Authorized users can delete quiz questions" ON public.quiz_questions
  FOR DELETE TO authenticated USING (can_manage_content_kit(kit_id));

DROP POLICY IF EXISTS "Authorized users can view kit shares" ON public.kit_shares;
CREATE POLICY "Authorized users can view kit shares" ON public.kit_shares
  FOR SELECT TO authenticated USING (can_view_content_kit(kit_id) OR shared_by = auth.uid());
DROP POLICY IF EXISTS "Authorized users can update kit shares" ON public.kit_shares;
CREATE POLICY "Authorized users can update kit shares" ON public.kit_shares
  FOR UPDATE TO authenticated USING (can_manage_content_kit(kit_id)) WITH CHECK (can_manage_content_kit(kit_id));
DROP POLICY IF EXISTS "Authorized users can delete kit shares" ON public.kit_shares;
CREATE POLICY "Authorized users can delete kit shares" ON public.kit_shares
  FOR DELETE TO authenticated USING (can_manage_content_kit(kit_id));

DROP POLICY IF EXISTS "Authorized users can view source files" ON public.source_files;
CREATE POLICY "Authorized users can view source files" ON public.source_files
  FOR SELECT TO authenticated USING (can_view_course_content(course_id));
DROP POLICY IF EXISTS "Authorized users can update source files" ON public.source_files;
CREATE POLICY "Authorized users can update source files" ON public.source_files
  FOR UPDATE TO authenticated USING (can_manage_course_content(course_id)) WITH CHECK (can_manage_course_content(course_id));

-- ── 5. Revoke anon EXECUTE on internal definer functions ────────
REVOKE EXECUTE ON FUNCTION public.get_safe_profiles(uuid[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_safe_profiles(uuid[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_student_live_class(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_live_class(uuid) TO authenticated, service_role;

-- ── 6. Guardrail: strip anon grants from every table with no anon-reachable policy
DO $$
DECLARE r record; keep text[] := ARRAY[
  'country_dial_codes','courses','leads','library_items','quiz_attempts',
  'registration_form_fields','registration_forms','registration_submissions',
  'rukus','surahs','timezone_mappings','demo_sessions','demo_feedback'
];
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT (c.relname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;