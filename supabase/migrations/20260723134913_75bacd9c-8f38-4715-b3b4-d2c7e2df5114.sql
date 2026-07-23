
-- 1. course_library_assets: require enrollment or staff
DROP POLICY IF EXISTS "Students can view published course assets" ON public.course_library_assets;
CREATE POLICY "Enrolled users view published course assets"
  ON public.course_library_assets
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND visibility = 'public'
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR owner_id = auth.uid()
      OR (course_id IS NOT NULL AND public.can_view_course_content(course_id))
    )
  );

-- 2. quiz_questions: hide raw rows (with correct answers) from students
DROP POLICY IF EXISTS "student_can_select_quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Authorized users can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Managers view quiz questions"
  ON public.quiz_questions
  FOR SELECT
  TO authenticated
  USING (public.can_manage_content_kit(kit_id));

-- 3. profiles: remove broad SELECT policies that leak PII columns to classmates/teachers/parents
DROP POLICY IF EXISTS "Students can view classmate profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers view safe student profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Parents view children assigned teacher profiles" ON public.profiles;
-- Owner, admin, super_admin, examiner, and "Parents can view children profiles" policies remain intact.
-- Teachers/students/parents should read peer profile data through existing SECURITY DEFINER RPCs
-- (get_student_profile_for_teacher, get_teacher_safe_profile, get_parent_children_teacher_ids, etc.)
-- which return only non-sensitive columns.

-- 4. Revoke EXECUTE on all SECURITY DEFINER functions from anon (they should never be callable
--    without signing in), then grant back only the intentionally public helpers.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.get_demo_by_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.list_public_quiz_banks_safe() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_quiz_bank_safe(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text, text) TO anon;
-- submit_demo_feedback if signature exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='submit_demo_feedback') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_demo_feedback(text, text, jsonb) TO anon';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
