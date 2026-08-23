CREATE OR REPLACE FUNCTION public.guard_student_assessment_grading_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  is_staff boolean;
BEGIN
  -- Trusted backend/database work has no end-user identity and remains unrestricted.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  is_staff := public.is_admin(actor)
    OR public.is_super_admin(actor)
    OR public.has_role(actor, 'teacher'::public.app_role)
    OR public.has_role(actor, 'examiner'::public.app_role);

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'speaking_assignment_submissions' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.final_score := NULL;
    ELSIF NEW.final_score IS DISTINCT FROM OLD.final_score THEN
      RAISE EXCEPTION 'Students cannot set speaking-assignment scores' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'teaching_exam_submissions' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.total_score := NULL;
      NEW.total_possible := NULL;
      NEW.percentage := NULL;
      NEW.passed := NULL;
    ELSIF NEW.total_score IS DISTINCT FROM OLD.total_score
       OR NEW.total_possible IS DISTINCT FROM OLD.total_possible
       OR NEW.percentage IS DISTINCT FROM OLD.percentage
       OR NEW.passed IS DISTINCT FROM OLD.passed THEN
      RAISE EXCEPTION 'Students cannot set teaching-exam results' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'teaching_exam_responses' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_correct := NULL;
      NEW.score_awarded := NULL;
      NEW.ai_score := NULL;
      NEW.ai_feedback := NULL;
      NEW.ai_confidence := NULL;
      NEW.teacher_score := NULL;
      NEW.teacher_feedback := NULL;
      NEW.teacher_reviewed := false;
      NEW.rubric_breakdown := NULL;
      NEW.marked_at := NULL;
    ELSIF NEW.is_correct IS DISTINCT FROM OLD.is_correct
       OR NEW.score_awarded IS DISTINCT FROM OLD.score_awarded
       OR NEW.ai_score IS DISTINCT FROM OLD.ai_score
       OR NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback
       OR NEW.ai_confidence IS DISTINCT FROM OLD.ai_confidence
       OR NEW.teacher_score IS DISTINCT FROM OLD.teacher_score
       OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback
       OR NEW.teacher_reviewed IS DISTINCT FROM OLD.teacher_reviewed
       OR NEW.rubric_breakdown IS DISTINCT FROM OLD.rubric_breakdown
       OR NEW.marked_at IS DISTINCT FROM OLD.marked_at THEN
      RAISE EXCEPTION 'Students cannot set teaching-exam grading fields' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_student_assessment_grading_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_student_assessment_grading_fields() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_student_grading_fields ON public.speaking_assignment_submissions;
CREATE TRIGGER trg_guard_student_grading_fields
BEFORE INSERT OR UPDATE ON public.speaking_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_assessment_grading_fields();

DROP TRIGGER IF EXISTS trg_guard_student_grading_fields ON public.teaching_exam_submissions;
CREATE TRIGGER trg_guard_student_grading_fields
BEFORE INSERT OR UPDATE ON public.teaching_exam_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_assessment_grading_fields();

DROP TRIGGER IF EXISTS trg_guard_student_grading_fields ON public.teaching_exam_responses;
CREATE TRIGGER trg_guard_student_grading_fields
BEFORE INSERT OR UPDATE ON public.teaching_exam_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_student_assessment_grading_fields();