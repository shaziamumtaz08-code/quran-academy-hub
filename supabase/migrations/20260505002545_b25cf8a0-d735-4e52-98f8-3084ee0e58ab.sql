
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

CREATE OR REPLACE FUNCTION public.fn_validate_user_role_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active','paused','left','completed','inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
    NEW.status_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_validate_user_role_status ON public.user_roles;
CREATE TRIGGER trg_validate_user_role_status
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_user_role_status();
