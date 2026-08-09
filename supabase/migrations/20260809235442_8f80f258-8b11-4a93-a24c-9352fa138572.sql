CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_priv boolean;
BEGIN
  -- Backend / service-role context has no JWT: always allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_priv := public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid());
  IF is_priv THEN
    RETURN NEW;
  END IF;

  IF NEW.gov_id_verified IS DISTINCT FROM OLD.gov_id_verified
     OR NEW.gov_id_verified_at IS DISTINCT FROM OLD.gov_id_verified_at
     OR NEW.gov_id_verified_by IS DISTINCT FROM OLD.gov_id_verified_by
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.banking_status IS DISTINCT FROM OLD.banking_status
     OR NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset
     OR NEW.default_payout_rate IS DISTINCT FROM OLD.default_payout_rate
     OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
     OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
     OR NEW.onboarding_token IS DISTINCT FROM OLD.onboarding_token
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  -- cv_status may only move to 'pending' as a side effect of uploading a new CV
  IF NEW.cv_status IS DISTINCT FROM OLD.cv_status
     AND NOT (NEW.cv_status = 'pending' AND NEW.cv_url IS DISTINCT FROM OLD.cv_url AND NEW.cv_url IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Not allowed to modify CV review status';
  END IF;

  RETURN NEW;
END;
$function$;