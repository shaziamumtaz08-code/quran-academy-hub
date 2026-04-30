-- Step 1a: Add admin_division enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_division';

-- Step 1b: Update is_admin() — cast role to text so new enum value doesn't need same-tx visibility
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text IN ('admin','admin_division','admin_admissions','admin_fees','admin_academic','super_admin')
  )
$$;

-- Step 1c: Fix 4 critical RLS leaks

-- drill_phrases (owner = parent speaking_drills.created_by)
DROP POLICY IF EXISTS "Authenticated insert/update/delete/select drill phrases" ON public.drill_phrases;
DROP POLICY IF EXISTS "Admin can manage drill_phrases" ON public.drill_phrases;
DROP POLICY IF EXISTS "Teacher can manage own drill_phrases" ON public.drill_phrases;
CREATE POLICY "Admin can manage drill_phrases" ON public.drill_phrases
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Teacher can manage own drill_phrases" ON public.drill_phrases
  FOR ALL USING (
    public.has_role(auth.uid(),'teacher'::app_role)
    AND drill_id IN (SELECT id FROM public.speaking_drills WHERE created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'teacher'::app_role)
    AND drill_id IN (SELECT id FROM public.speaking_drills WHERE created_by = auth.uid())
  );

-- playlist_videos (owner column = added_by)
DROP POLICY IF EXISTS "Authenticated insert/update/delete/select" ON public.playlist_videos;
DROP POLICY IF EXISTS "Admin can manage playlist_videos" ON public.playlist_videos;
DROP POLICY IF EXISTS "Teacher can manage own playlist_videos" ON public.playlist_videos;
CREATE POLICY "Admin can manage playlist_videos" ON public.playlist_videos
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Teacher can manage own playlist_videos" ON public.playlist_videos
  FOR ALL USING (public.has_role(auth.uid(),'teacher'::app_role) AND added_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'teacher'::app_role) AND added_by = auth.uid());

-- course_quiz_questions
DROP POLICY IF EXISTS "Authenticated can view quiz questions" ON public.course_quiz_questions;
DROP POLICY IF EXISTS "Admin can manage quiz questions" ON public.course_quiz_questions;
DROP POLICY IF EXISTS "Teacher can manage own course quiz questions" ON public.course_quiz_questions;
DROP POLICY IF EXISTS "Student can view quiz questions when attempting" ON public.course_quiz_questions;
CREATE POLICY "Admin can manage quiz questions" ON public.course_quiz_questions
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Teacher can manage own course quiz questions" ON public.course_quiz_questions
  FOR ALL USING (
    public.has_role(auth.uid(),'teacher'::app_role)
    AND quiz_id IN (SELECT id FROM public.course_quizzes WHERE created_by = auth.uid())
  )
  WITH CHECK (public.has_role(auth.uid(),'teacher'::app_role));
CREATE POLICY "Student can view quiz questions when attempting" ON public.course_quiz_questions
  FOR SELECT USING (
    public.has_role(auth.uid(),'student'::app_role)
    AND quiz_id IN (SELECT quiz_id FROM public.course_quiz_attempts WHERE student_id = auth.uid())
  );

-- academy_reports
DROP POLICY IF EXISTS "Authenticated users can create academy reports" ON public.academy_reports;
DROP POLICY IF EXISTS "Admin and teacher can create academy reports" ON public.academy_reports;
CREATE POLICY "Admin and teacher can create academy reports" ON public.academy_reports
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'teacher'::app_role)
  );