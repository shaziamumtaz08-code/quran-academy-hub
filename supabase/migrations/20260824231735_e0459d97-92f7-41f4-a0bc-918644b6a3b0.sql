CREATE OR REPLACE FUNCTION public.fn_guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  -- service_role / internal jobs bypass
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

  -- Non-staff users may not change admin-controlled fields on any profile
  NEW.gov_id_verified        := OLD.gov_id_verified;
  NEW.gov_id_verified_by     := OLD.gov_id_verified_by;
  NEW.account_status         := OLD.account_status;
  NEW.cv_status              := OLD.cv_status;
  NEW.banking_status         := OLD.banking_status;
  NEW.force_password_reset   := OLD.force_password_reset;
  NEW.default_payout_rate    := OLD.default_payout_rate;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profile_privileged_fields();