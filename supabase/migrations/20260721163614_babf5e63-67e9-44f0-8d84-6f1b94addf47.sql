
-- Audit trail + duplicate guard for attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_attendance_created_by ON public.attendance(created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_updated_by ON public.attendance(updated_by);

-- Auto-populate created_by / updated_by from auth.uid()
CREATE OR REPLACE FUNCTION public.attendance_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN NEW.created_by := actor; END IF;
    IF NEW.updated_by IS NULL THEN NEW.updated_by := actor; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(actor, NEW.updated_by, OLD.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_set_actor ON public.attendance;
CREATE TRIGGER trg_attendance_set_actor
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_set_actor();

-- Block NEW exact-duplicate attendance rows (same student+teacher+date+time).
-- Existing duplicates are left in place per extend-only rule.
CREATE OR REPLACE FUNCTION public.attendance_block_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = NEW.student_id
      AND teacher_id = NEW.teacher_id
      AND class_date = NEW.class_date
      AND class_time = NEW.class_time
  ) THEN
    RAISE EXCEPTION 'Attendance already exists for this student at % on %. Please edit the existing record instead of creating a duplicate.',
      NEW.class_time, NEW.class_date
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_block_duplicate ON public.attendance;
CREATE TRIGGER trg_attendance_block_duplicate
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_block_duplicate();

-- Dedicated audit log table for who-changed-what-when
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_row jsonb,
  new_row jsonb
);

GRANT SELECT, INSERT ON public.attendance_audit_log TO authenticated;
GRANT ALL ON public.attendance_audit_log TO service_role;

ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read attendance audit" ON public.attendance_audit_log;
CREATE POLICY "Admins can read attendance audit"
  ON public.attendance_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'admin_division'));

DROP POLICY IF EXISTS "System can insert attendance audit" ON public.attendance_audit_log;
CREATE POLICY "System can insert attendance audit"
  ON public.attendance_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_att_audit_attendance ON public.attendance_audit_log(attendance_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_att_audit_actor ON public.attendance_audit_log(actor_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.attendance_write_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.attendance_audit_log(attendance_id, action, actor_id, new_row)
    VALUES (NEW.id, 'insert', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.attendance_audit_log(attendance_id, action, actor_id, old_row, new_row)
    VALUES (NEW.id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.attendance_audit_log(attendance_id, action, actor_id, old_row)
    VALUES (OLD.id, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_write_audit ON public.attendance;
CREATE TRIGGER trg_attendance_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_write_audit();
