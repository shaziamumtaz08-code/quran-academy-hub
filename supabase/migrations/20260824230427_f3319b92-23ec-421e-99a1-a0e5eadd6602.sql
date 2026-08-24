-- 1. course_eligibility_rules: no longer readable by every authenticated user
DROP POLICY IF EXISTS "Anyone authenticated can view eligibility rules" ON public.course_eligibility_rules;

CREATE POLICY "Staff and enrolled students view eligibility rules"
ON public.course_eligibility_rules
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR public.is_course_staff(auth.uid(), course_id)
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.course_id = course_eligibility_rules.course_id
      AND ce.student_id = auth.uid()
  )
);

-- 2. quiz_attempts: bind attempt creation to actual access to the quiz bank
DROP POLICY IF EXISTS "Users create own attempts" ON public.quiz_attempts;

CREATE POLICY "Users create own attempts"
ON public.quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.quiz_banks qb
    WHERE qb.id = quiz_attempts.quiz_bank_id
      AND (
        (qb.mode = 'public' AND qb.status = 'published')
        OR public.can_view_quiz_bank(auth.uid(), qb.id)
        OR public.is_course_staff(auth.uid(), qb.course_id)
        OR EXISTS (
          SELECT 1 FROM public.course_enrollments ce
          WHERE ce.course_id = qb.course_id AND ce.student_id = auth.uid()
        )
      )
  )
);

-- 3. quiz_collaborators: stronger invite tokens, tokens never client-writable
ALTER TABLE public.quiz_collaborators
  ALTER COLUMN invite_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE OR REPLACE FUNCTION public.fn_quiz_collab_token_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.invite_token := encode(gen_random_bytes(32), 'hex');
    NEW.accepted_at := NULL;
  ELSE
    NEW.invite_token := OLD.invite_token;
    NEW.accepted_at := OLD.accepted_at;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_collab_token_guard ON public.quiz_collaborators;
CREATE TRIGGER trg_quiz_collab_token_guard
BEFORE INSERT OR UPDATE ON public.quiz_collaborators
FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_collab_token_guard();

-- 4. quiz_generation_jobs: explicit fail-closed SELECT policy for realtime consumers
DROP POLICY IF EXISTS "Job owners and admins read jobs" ON public.quiz_generation_jobs;
CREATE POLICY "Job owners and admins read jobs"
ON public.quiz_generation_jobs
FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));