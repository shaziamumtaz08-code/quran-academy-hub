CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_priv boolean;
BEGIN
  is_priv := public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid());
  IF is_priv THEN
    RETURN NEW;
  END IF;

  IF NEW.gov_id_verified IS DISTINCT FROM OLD.gov_id_verified
     OR NEW.gov_id_verified_by IS DISTINCT FROM OLD.gov_id_verified_by
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset
     OR NEW.default_payout_rate IS DISTINCT FROM OLD.default_payout_rate
     OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
     OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;