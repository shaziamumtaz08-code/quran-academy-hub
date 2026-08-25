CREATE OR REPLACE FUNCTION public.fn_guard_profile_privileged_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','super_admin','admin_division','admin_academic','admin_admissions','admin_fees')
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.gov_id_verified        := OLD.gov_id_verified;
  NEW.gov_id_verified_by     := OLD.gov_id_verified_by;
  NEW.account_status         := OLD.account_status;
  NEW.cv_status              := OLD.cv_status;
  NEW.banking_status         := OLD.banking_status;
  NEW.default_payout_rate    := OLD.default_payout_rate;

  -- A user may clear their OWN temporary-password flag (only true -> false)
  -- after actually changing their password; nobody may set it back on.
  IF NOT (NEW.id = auth.uid() AND OLD.force_password_reset IS TRUE AND NEW.force_password_reset IS FALSE) THEN
    NEW.force_password_reset := OLD.force_password_reset;
  END IF;

  RETURN NEW;
END;
$function$;