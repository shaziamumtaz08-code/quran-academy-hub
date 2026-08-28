-- Backfill division memberships for students who have active 1:1 assignments
INSERT INTO public.user_context (user_id, branch_id, division_id, is_default, primary_role)
SELECT DISTINCT sta.student_id, d.branch_id, sta.division_id, false, 'student'
FROM public.student_teacher_assignments sta
JOIN public.divisions d ON d.id = sta.division_id
WHERE sta.student_id IS NOT NULL
  AND sta.division_id IS NOT NULL
  AND sta.status IN ('active','on_hold')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_context uc
    WHERE uc.user_id = sta.student_id AND uc.division_id = sta.division_id
  );

-- Backfill division memberships for teachers of active 1:1 assignments
INSERT INTO public.user_context (user_id, branch_id, division_id, is_default, primary_role)
SELECT DISTINCT sta.teacher_id, d.branch_id, sta.division_id, false, 'teacher'
FROM public.student_teacher_assignments sta
JOIN public.divisions d ON d.id = sta.division_id
WHERE sta.teacher_id IS NOT NULL
  AND sta.division_id IS NOT NULL
  AND sta.status IN ('active','on_hold')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_context uc
    WHERE uc.user_id = sta.teacher_id AND uc.division_id = sta.division_id
  );

-- Keep memberships in sync going forward
CREATE OR REPLACE FUNCTION public.fn_sync_user_context_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
BEGIN
  IF NEW.division_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT branch_id INTO v_branch FROM public.divisions WHERE id = NEW.division_id;

  IF NEW.student_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_context uc WHERE uc.user_id = NEW.student_id AND uc.division_id = NEW.division_id
  ) THEN
    INSERT INTO public.user_context (user_id, branch_id, division_id, is_default, primary_role)
    VALUES (NEW.student_id, v_branch, NEW.division_id, false, 'student');
  END IF;

  IF NEW.teacher_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_context uc WHERE uc.user_id = NEW.teacher_id AND uc.division_id = NEW.division_id
  ) THEN
    INSERT INTO public.user_context (user_id, branch_id, division_id, is_default, primary_role)
    VALUES (NEW.teacher_id, v_branch, NEW.division_id, false, 'teacher');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_context_from_assignment ON public.student_teacher_assignments;
CREATE TRIGGER trg_sync_user_context_from_assignment
AFTER INSERT OR UPDATE OF division_id, student_id, teacher_id ON public.student_teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_user_context_from_assignment();