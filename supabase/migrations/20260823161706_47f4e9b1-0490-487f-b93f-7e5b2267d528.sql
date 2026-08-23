ALTER TABLE public.family_registrations
  ADD COLUMN IF NOT EXISTS submission_source text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS target_division_id uuid REFERENCES public.divisions(id);

ALTER TABLE public.family_registrations
  DROP CONSTRAINT IF EXISTS family_registrations_submission_source_check;
ALTER TABLE public.family_registrations
  ADD CONSTRAINT family_registrations_submission_source_check
  CHECK (submission_source IN ('public', 'admin'));

CREATE OR REPLACE FUNCTION public.protect_course_submission_grading_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.student_id
     AND NOT public.is_admin(auth.uid())
     AND NOT public.is_super_admin(auth.uid())
     AND (
       NEW.score IS DISTINCT FROM OLD.score OR
       NEW.feedback IS DISTINCT FROM OLD.feedback OR
       NEW.feedback_voice_url IS DISTINCT FROM OLD.feedback_voice_url OR
       NEW.annotations IS DISTINCT FROM OLD.annotations OR
       NEW.graded_by IS DISTINCT FROM OLD.graded_by OR
       NEW.graded_at IS DISTINCT FROM OLD.graded_at
     ) THEN
    RAISE EXCEPTION 'Students cannot modify grading or feedback fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_course_submission_grading_fields ON public.course_assignment_submissions;
CREATE TRIGGER trg_protect_course_submission_grading_fields
BEFORE UPDATE ON public.course_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_course_submission_grading_fields();

CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT public.is_admin(auth.uid())
     AND NOT public.is_super_admin(auth.uid())
     AND (
       NEW.gov_id_verified IS DISTINCT FROM OLD.gov_id_verified OR
       NEW.banking_status IS DISTINCT FROM OLD.banking_status OR
       NEW.cv_status IS DISTINCT FROM OLD.cv_status OR
       NEW.account_status IS DISTINCT FROM OLD.account_status OR
       NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset OR
       NEW.default_payout_rate IS DISTINCT FROM OLD.default_payout_rate OR
       NEW.employment_type IS DISTINCT FROM OLD.employment_type OR
       NEW.department IS DISTINCT FROM OLD.department OR
       NEW.designation IS DISTINCT FROM OLD.designation
     ) THEN
    RAISE EXCEPTION 'Administrative profile fields can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

CREATE OR REPLACE FUNCTION public.protect_quiz_attempt_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.student_id
     AND NOT public.is_admin(auth.uid())
     AND NOT public.is_super_admin(auth.uid())
     AND (
       NEW.score IS DISTINCT FROM OLD.score OR
       NEW.max_score IS DISTINCT FROM OLD.max_score OR
       NEW.percentage IS DISTINCT FROM OLD.percentage OR
       NEW.results IS DISTINCT FROM OLD.results
     ) THEN
    RAISE EXCEPTION 'Quiz scores are calculated by the grading service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_quiz_attempt_scores ON public.quiz_attempts;
CREATE TRIGGER trg_protect_quiz_attempt_scores
BEFORE UPDATE ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.protect_quiz_attempt_scores();