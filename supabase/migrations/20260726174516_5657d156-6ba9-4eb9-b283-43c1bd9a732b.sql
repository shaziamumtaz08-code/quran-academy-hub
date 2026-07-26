
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / backend context (no JWT) and admins bypass
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.id = auth.uid() THEN
    NEW.gov_id_verified     := OLD.gov_id_verified;
    NEW.gov_id_verified_at  := OLD.gov_id_verified_at;
    NEW.gov_id_verified_by  := OLD.gov_id_verified_by;
    NEW.account_status      := OLD.account_status;
    NEW.force_password_reset:= OLD.force_password_reset;
    NEW.default_payout_rate := OLD.default_payout_rate;
    NEW.archived_at         := OLD.archived_at;
    NEW.registration_id     := OLD.registration_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

CREATE OR REPLACE FUNCTION public.guard_submission_grading_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_admin(auth.uid())
     OR public.is_super_admin(auth.uid())
     OR public.has_role(auth.uid(), 'teacher'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.score     := NULL;
    NEW.feedback  := NULL;
    NEW.graded_by := NULL;
    NEW.graded_at := NULL;
    IF NEW.status IS DISTINCT FROM 'submitted' THEN
      NEW.status := 'submitted';
    END IF;
    RETURN NEW;
  END IF;

  NEW.score     := OLD.score;
  NEW.feedback  := OLD.feedback;
  NEW.graded_by := OLD.graded_by;
  NEW.graded_at := OLD.graded_at;
  NEW.status    := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_submission_grading_columns ON public.course_assignment_submissions;
CREATE TRIGGER trg_guard_submission_grading_columns
BEFORE INSERT OR UPDATE ON public.course_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_submission_grading_columns();
