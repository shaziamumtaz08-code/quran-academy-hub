CREATE OR REPLACE FUNCTION public.fn_preserve_assignment_on_teacher_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end date;
  v_new_id uuid;
BEGIN
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    -- Determine when the old teacher's period ended
    v_end := COALESCE(
      NEW.effective_from_date - 1,
      OLD.effective_to_date,
      (CURRENT_DATE - 1)
    );

    -- Preserve the old teacher's period as its own completed assignment row
    INSERT INTO public.student_teacher_assignments (
      student_id, teacher_id, subject_id, branch_id, division_id,
      duration_minutes, payout_amount, payout_type, fee_package_id,
      requires_schedule, requires_planning, requires_attendance,
      status, effective_from_date, effective_to_date,
      status_effective_date, status_change_reason, transfer_type, salary_linked
    ) VALUES (
      OLD.student_id, OLD.teacher_id, OLD.subject_id, OLD.branch_id, OLD.division_id,
      OLD.duration_minutes, OLD.payout_amount, OLD.payout_type, OLD.fee_package_id,
      OLD.requires_schedule, OLD.requires_planning, OLD.requires_attendance,
      'completed', OLD.effective_from_date, v_end,
      v_end, 'Auto-preserved: teacher changed in place on assignment ' || OLD.id::text,
      'permanent', OLD.salary_linked
    )
    RETURNING id INTO v_new_id;

    -- Re-point the open history row (if any) for the old teacher to the preserved assignment
    UPDATE public.assignment_history
    SET assignment_id = v_new_id,
        ended_at = COALESCE(ended_at, v_end::timestamptz)
    WHERE assignment_id = OLD.id
      AND teacher_id = OLD.teacher_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_assignment_on_teacher_change ON public.student_teacher_assignments;
CREATE TRIGGER trg_preserve_assignment_on_teacher_change
BEFORE UPDATE OF teacher_id ON public.student_teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION public.fn_preserve_assignment_on_teacher_change();