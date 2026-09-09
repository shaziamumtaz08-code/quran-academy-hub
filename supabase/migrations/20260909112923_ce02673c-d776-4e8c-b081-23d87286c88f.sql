create or replace function public.fn_flag_billing_on_assignment_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.status IN ('left','completed')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.effective_to_date IS DISTINCT FROM NEW.effective_to_date
       OR OLD.status_effective_date IS DISTINCT FROM NEW.status_effective_date
     ) THEN
    v_reason := NULLIF(btrim(COALESCE(NEW.status_change_reason, '')), '');
    IF v_reason IS NULL OR length(regexp_replace(v_reason, '[^a-zA-Z0-9]', '', 'g')) < 4 THEN
      v_reason := 'Assignment ' || NEW.status || ' — billing closed automatically';
    END IF;

    UPDATE public.student_billing_plans
       SET lifecycle_status = 'pending_closure',
           pending_closure_at = now(),
           billing_close_date = COALESCE(NEW.effective_to_date, NEW.status_effective_date, CURRENT_DATE),
           change_reason = v_reason,
           updated_at = now()
     WHERE assignment_id = NEW.id
       AND lifecycle_status IN ('open', 'pending_closure');
  END IF;
  RETURN NEW;
END;
$$;