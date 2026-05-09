-- 1. Add on_hold to enum
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'on_hold';

-- 2. Audit columns on student_teacher_assignments
ALTER TABLE public.student_teacher_assignments
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_changed_by UUID,
  ADD COLUMN IF NOT EXISTS status_change_reason TEXT;

-- 3. Trigger to stamp audit fields on status change
CREATE OR REPLACE FUNCTION public.fn_stamp_assignment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
    NEW.status_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_assignment_status_change ON public.student_teacher_assignments;
CREATE TRIGGER stamp_assignment_status_change
  BEFORE UPDATE ON public.student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_assignment_status_change();

-- 4. Guard against hard-deleting assignments with historical records
CREATE OR REPLACE FUNCTION public.guard_assignment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attendance_count INTEGER;
  invoice_count INTEGER;
  salary_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attendance_count
  FROM public.attendance
  WHERE student_id = OLD.student_id AND teacher_id = OLD.teacher_id;

  SELECT COUNT(*) INTO invoice_count
  FROM public.fee_invoices WHERE assignment_id = OLD.id;

  SELECT COUNT(*) INTO salary_count
  FROM public.salary_payouts WHERE teacher_id = OLD.teacher_id;

  IF attendance_count > 0 OR invoice_count > 0 OR salary_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete assignment with historical records. Set status to completed or left instead. Found: % attendance, % invoices, % salary records.',
      attendance_count, invoice_count, salary_count;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_assignment_delete_trigger ON public.student_teacher_assignments;
CREATE TRIGGER guard_assignment_delete_trigger
  BEFORE DELETE ON public.student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_delete();