CREATE OR REPLACE FUNCTION public.fn_validate_user_role_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('active','paused','on_hold','left','completed','inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
    NEW.status_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END$function$;