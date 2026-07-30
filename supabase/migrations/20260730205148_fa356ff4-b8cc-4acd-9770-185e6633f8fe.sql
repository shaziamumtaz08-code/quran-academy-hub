CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'admin_division') THEN
    IF NEW.gov_id_verified IS DISTINCT FROM OLD.gov_id_verified
      OR NEW.gov_id_verified_by IS DISTINCT FROM OLD.gov_id_verified_by
      OR NEW.gov_id_verified_at IS DISTINCT FROM OLD.gov_id_verified_at
      OR NEW.account_status IS DISTINCT FROM OLD.account_status
      OR NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset
      OR NEW.default_payout_rate IS DISTINCT FROM OLD.default_payout_rate
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
      OR NEW.bank_iban IS DISTINCT FROM OLD.bank_iban THEN
      RAISE EXCEPTION 'Sensitive profile fields may only be changed by an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_profile_fields();