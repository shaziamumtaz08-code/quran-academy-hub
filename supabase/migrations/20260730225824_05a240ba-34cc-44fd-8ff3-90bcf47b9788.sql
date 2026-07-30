-- 1. course_assignment_submissions: split the student ALL policy (trigger already strips grading columns)
DROP POLICY IF EXISTS "Students can manage their own submissions" ON public.course_assignment_submissions;

CREATE POLICY "Students can insert their own submissions"
ON public.course_assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own submissions"
ON public.course_assignment_submissions
FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can delete their own submissions"
ON public.course_assignment_submissions
FOR DELETE TO authenticated
USING (student_id = auth.uid() AND graded_at IS NULL);

-- 2. speaking_assignment_submissions: guard grading columns + split policy
CREATE OR REPLACE FUNCTION public.guard_speaking_submission_grading()
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
    NEW.final_score := NULL;
    IF NEW.status IS DISTINCT FROM 'assigned' THEN
      NEW.status := 'assigned';
    END IF;
    RETURN NEW;
  END IF;

  NEW.final_score := OLD.final_score;
  NEW.status      := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_speaking_submission_grading ON public.speaking_assignment_submissions;
CREATE TRIGGER trg_guard_speaking_submission_grading
BEFORE INSERT OR UPDATE ON public.speaking_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_speaking_submission_grading();

DROP POLICY IF EXISTS "Users manage own submissions" ON public.speaking_assignment_submissions;

CREATE POLICY "Students can insert their own speaking submissions"
ON public.speaking_assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own speaking submissions"
ON public.speaking_assignment_submissions
FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers and admins manage speaking submissions"
ON public.speaking_assignment_submissions
FOR ALL TO authenticated
USING (
  is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role)
);