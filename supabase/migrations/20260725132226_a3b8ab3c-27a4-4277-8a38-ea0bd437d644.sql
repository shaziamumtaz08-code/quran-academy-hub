ALTER TABLE public.profile_sensitive_data
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_title text;

UPDATE public.profile_sensitive_data psd
SET
  bank_name = COALESCE(psd.bank_name, p.bank_name),
  bank_account_title = COALESCE(psd.bank_account_title, p.bank_account_title),
  updated_at = now()
FROM public.profiles p
WHERE psd.user_id = p.id
  AND (p.bank_name IS NOT NULL OR p.bank_account_title IS NOT NULL);

INSERT INTO public.profile_sensitive_data (
  user_id,
  bank_account_number,
  bank_iban,
  bank_name,
  bank_account_title,
  gov_id_number,
  gov_id_doc_url,
  emergency_contact_phone,
  whatsapp_number,
  date_of_birth
)
SELECT
  p.id,
  p.bank_account_number,
  p.bank_iban,
  p.bank_name,
  p.bank_account_title,
  p.gov_id_number,
  p.gov_id_doc_url,
  p.emergency_contact_phone,
  p.whatsapp_number,
  p.date_of_birth
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_sensitive_data psd WHERE psd.user_id = p.id
)
AND (
  p.bank_account_number IS NOT NULL
  OR p.bank_iban IS NOT NULL
  OR p.bank_name IS NOT NULL
  OR p.bank_account_title IS NOT NULL
  OR p.gov_id_number IS NOT NULL
  OR p.gov_id_doc_url IS NOT NULL
  OR p.emergency_contact_phone IS NOT NULL
  OR p.whatsapp_number IS NOT NULL
  OR p.date_of_birth IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.mirror_profile_sensitive_to_new_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bank_account_number IS NOT NULL
     OR NEW.bank_iban IS NOT NULL
     OR NEW.bank_name IS NOT NULL
     OR NEW.bank_account_title IS NOT NULL
     OR NEW.gov_id_number IS NOT NULL
     OR NEW.gov_id_doc_url IS NOT NULL
     OR NEW.emergency_contact_phone IS NOT NULL
     OR NEW.whatsapp_number IS NOT NULL
     OR NEW.date_of_birth IS NOT NULL THEN
    INSERT INTO public.profile_sensitive_data (
      user_id,
      bank_account_number,
      bank_iban,
      bank_name,
      bank_account_title,
      gov_id_number,
      gov_id_doc_url,
      emergency_contact_phone,
      whatsapp_number,
      date_of_birth
    ) VALUES (
      NEW.id,
      NEW.bank_account_number,
      NEW.bank_iban,
      NEW.bank_name,
      NEW.bank_account_title,
      NEW.gov_id_number,
      NEW.gov_id_doc_url,
      NEW.emergency_contact_phone,
      NEW.whatsapp_number,
      NEW.date_of_birth
    )
    ON CONFLICT (user_id) DO UPDATE SET
      bank_account_number     = COALESCE(EXCLUDED.bank_account_number,     profile_sensitive_data.bank_account_number),
      bank_iban               = COALESCE(EXCLUDED.bank_iban,               profile_sensitive_data.bank_iban),
      bank_name               = COALESCE(EXCLUDED.bank_name,               profile_sensitive_data.bank_name),
      bank_account_title      = COALESCE(EXCLUDED.bank_account_title,      profile_sensitive_data.bank_account_title),
      gov_id_number           = COALESCE(EXCLUDED.gov_id_number,           profile_sensitive_data.gov_id_number),
      gov_id_doc_url          = COALESCE(EXCLUDED.gov_id_doc_url,          profile_sensitive_data.gov_id_doc_url),
      emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, profile_sensitive_data.emergency_contact_phone),
      whatsapp_number         = COALESCE(EXCLUDED.whatsapp_number,         profile_sensitive_data.whatsapp_number),
      date_of_birth           = COALESCE(EXCLUDED.date_of_birth,           profile_sensitive_data.date_of_birth),
      updated_at              = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_mirror_profile_sensitive
  AFTER INSERT OR UPDATE OF bank_account_number, bank_iban, bank_name, bank_account_title, gov_id_number, gov_id_doc_url,
                            emergency_contact_phone, whatsapp_number, date_of_birth
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mirror_profile_sensitive_to_new_table();

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id,
  full_name,
  email,
  created_at,
  updated_at,
  mushaf_type,
  daily_target_lines,
  preferred_unit,
  daily_target_amount,
  gender,
  age,
  preferred_language,
  country,
  city,
  meeting_link,
  timezone,
  country_code,
  region,
  archived_at,
  registration_id,
  default_payout_rate,
  teaching_os_language,
  gov_id_type,
  gov_id_verified,
  gov_id_verified_at,
  gov_id_verified_by,
  guardian_type,
  emergency_contact_name,
  learning_goals,
  special_needs,
  hear_about_us,
  arabic_level,
  first_language,
  nationality,
  preferred_contact_method,
  display_name,
  account_status,
  force_password_reset
) ON public.profiles TO anon;

GRANT SELECT (
  id,
  full_name,
  email,
  created_at,
  updated_at,
  mushaf_type,
  daily_target_lines,
  preferred_unit,
  daily_target_amount,
  gender,
  age,
  preferred_language,
  country,
  city,
  meeting_link,
  timezone,
  country_code,
  region,
  archived_at,
  registration_id,
  default_payout_rate,
  teaching_os_language,
  gov_id_type,
  gov_id_verified,
  gov_id_verified_at,
  gov_id_verified_by,
  guardian_type,
  emergency_contact_name,
  learning_goals,
  special_needs,
  hear_about_us,
  arabic_level,
  first_language,
  nationality,
  preferred_contact_method,
  display_name,
  account_status,
  force_password_reset
) ON public.profiles TO authenticated;

GRANT SELECT ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_sensitive_data TO authenticated;
GRANT ALL ON public.profile_sensitive_data TO service_role;