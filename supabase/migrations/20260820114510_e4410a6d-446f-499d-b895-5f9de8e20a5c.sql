CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / internal calls (no JWT) and admins are unrestricted
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Self-service updates cannot alter admin-controlled verification,
  -- status, compliance or payout fields.
  NEW.gov_id_verified        := OLD.gov_id_verified;
  NEW.gov_id_verified_at     := OLD.gov_id_verified_at;
  NEW.gov_id_verified_by     := OLD.gov_id_verified_by;
  NEW.banking_status         := OLD.banking_status;
  NEW.cv_status              := OLD.cv_status;
  NEW.account_status         := OLD.account_status;
  NEW.force_password_reset   := OLD.force_password_reset;
  NEW.default_payout_rate    := OLD.default_payout_rate;
  NEW.archived_at            := OLD.archived_at;
  NEW.employment_type        := OLD.employment_type;
  NEW.joining_date           := OLD.joining_date;
  NEW.registration_id        := OLD.registration_id;
  NEW.onboarding_token       := OLD.onboarding_token;
  NEW.possible_duplicate_of  := OLD.possible_duplicate_of;
  NEW.duplicate_flag_reason  := OLD.duplicate_flag_reason;
  NEW.duplicate_flagged_at   := OLD.duplicate_flagged_at;
  NEW.duplicate_reviewed_at  := OLD.duplicate_reviewed_at;
  NEW.duplicate_reviewed_by  := OLD.duplicate_reviewed_by;
  NEW.id                     := OLD.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

CREATE OR REPLACE FUNCTION public.guard_profile_self_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.gov_id_verified      := false;
  NEW.gov_id_verified_at   := NULL;
  NEW.gov_id_verified_by   := NULL;
  NEW.banking_status       := NULL;
  NEW.cv_status            := NULL;
  NEW.account_status       := NULL;
  NEW.force_password_reset := NULL;
  NEW.default_payout_rate  := NULL;
  NEW.archived_at          := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_insert ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_insert();