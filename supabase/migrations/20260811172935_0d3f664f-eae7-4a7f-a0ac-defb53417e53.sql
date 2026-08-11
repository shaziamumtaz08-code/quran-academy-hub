-- Table access is required for the manager-only read policy to work at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
REVOKE ALL ON public.quiz_questions FROM anon;

-- Answer key is never readable directly, even by managers' clients that over-select:
-- managers keep full access, students are excluded by the manager-only SELECT policy.
DROP POLICY IF EXISTS "Students view quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Managers view quiz questions" ON public.quiz_questions;
CREATE POLICY "Managers view quiz questions" ON public.quiz_questions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_manage_content_kit(kit_id));