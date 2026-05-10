-- Audit log for assignment field changes
CREATE TABLE IF NOT EXISTS public.assignment_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created' | 'field_changed'
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_audit_log_assignment
  ON public.assignment_audit_log(assignment_id, changed_at DESC);

ALTER TABLE public.assignment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view assignment_audit_log"
  ON public.assignment_audit_log FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin_academic'::app_role)
    OR public.has_role(auth.uid(), 'admin_fees'::app_role)
  );

CREATE POLICY "Teachers view own assignment_audit_log"
  ON public.assignment_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_teacher_assignments sta
      WHERE sta.id = assignment_audit_log.assignment_id
        AND sta.teacher_id = auth.uid()
    )
  );

-- Trigger function: records insert + every meaningful field change
CREATE OR REPLACE FUNCTION public.fn_log_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _reason TEXT := NEW.status_change_reason;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.assignment_audit_log
      (assignment_id, event_type, field_name, new_value, reason, changed_by)
    VALUES
      (NEW.id, 'created', 'status', NEW.status::text, _reason, _uid);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, reason, changed_by)
    VALUES (NEW.id, 'field_changed', 'status', OLD.status::text, NEW.status::text, _reason, _uid);
  END IF;

  IF NEW.payout_amount IS DISTINCT FROM OLD.payout_amount THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'payout_amount', OLD.payout_amount::text, NEW.payout_amount::text, _uid);
  END IF;

  IF NEW.payout_type IS DISTINCT FROM OLD.payout_type THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'payout_type', OLD.payout_type, NEW.payout_type, _uid);
  END IF;

  IF NEW.effective_from_date IS DISTINCT FROM OLD.effective_from_date THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'effective_from_date', OLD.effective_from_date::text, NEW.effective_from_date::text, _uid);
  END IF;

  IF NEW.effective_to_date IS DISTINCT FROM OLD.effective_to_date THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'effective_to_date', OLD.effective_to_date::text, NEW.effective_to_date::text, _uid);
  END IF;

  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, reason, changed_by)
    VALUES (NEW.id, 'field_changed', 'teacher_id', OLD.teacher_id::text, NEW.teacher_id::text, _reason, _uid);
  END IF;

  IF NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'subject_id', OLD.subject_id::text, NEW.subject_id::text, _uid);
  END IF;

  IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'duration_minutes', OLD.duration_minutes::text, NEW.duration_minutes::text, _uid);
  END IF;

  IF NEW.transfer_type IS DISTINCT FROM OLD.transfer_type THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'transfer_type', OLD.transfer_type, NEW.transfer_type, _uid);
  END IF;

  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    INSERT INTO public.assignment_audit_log(assignment_id, event_type, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'field_changed', 'start_date', OLD.start_date::text, NEW.start_date::text, _uid);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_assignment_changes ON public.student_teacher_assignments;
CREATE TRIGGER trg_log_assignment_changes
AFTER INSERT OR UPDATE ON public.student_teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_log_assignment_changes();

-- Backfill: seed a 'created' event for existing assignments that have no log entries yet
INSERT INTO public.assignment_audit_log
  (assignment_id, event_type, field_name, new_value, reason, changed_by, changed_at)
SELECT sta.id, 'created', 'status', sta.status::text, sta.status_change_reason, sta.status_changed_by, sta.created_at
FROM public.student_teacher_assignments sta
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignment_audit_log al WHERE al.assignment_id = sta.id
);