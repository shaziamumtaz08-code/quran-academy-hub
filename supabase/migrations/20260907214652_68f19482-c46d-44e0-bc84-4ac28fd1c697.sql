GRANT INSERT ON public.family_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_registrations TO authenticated;
GRANT ALL ON public.family_registrations TO service_role;

DROP POLICY IF EXISTS "Admin can manage assignments" ON public.student_teacher_assignments;
CREATE POLICY "Admin can manage assignments"
ON public.student_teacher_assignments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_flag_billing_on_assignment_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('left','completed')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.effective_to_date IS DISTINCT FROM NEW.effective_to_date
       OR OLD.status_effective_date IS DISTINCT FROM NEW.status_effective_date
     ) THEN
    UPDATE public.student_billing_plans
       SET lifecycle_status = 'pending_closure',
           pending_closure_at = now(),
           billing_close_date = COALESCE(NEW.effective_to_date, NEW.status_effective_date, CURRENT_DATE),
           updated_at = now()
     WHERE assignment_id = NEW.id
       AND lifecycle_status IN ('open', 'pending_closure');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_billing_on_assignment_end ON public.student_teacher_assignments;
CREATE TRIGGER trg_flag_billing_on_assignment_end
AFTER UPDATE OF status, effective_to_date, status_effective_date
ON public.student_teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION public.fn_flag_billing_on_assignment_end();