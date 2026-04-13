
-- Country dial codes lookup table
CREATE TABLE IF NOT EXISTS public.country_dial_codes (
  country TEXT NOT NULL,
  dial_code TEXT NOT NULL,
  PRIMARY KEY (country)
);

ALTER TABLE public.country_dial_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dial codes"
  ON public.country_dial_codes FOR SELECT
  USING (true);

INSERT INTO public.country_dial_codes (country, dial_code) VALUES
  ('Pakistan', '+92'), ('India', '+91'), ('United Arab Emirates', '+971'),
  ('UAE', '+971'), ('Saudi Arabia', '+966'), ('KSA', '+966'),
  ('United Kingdom', '+44'), ('UK', '+44'), ('United States', '+1'),
  ('USA', '+1'), ('Canada', '+1'), ('Australia', '+61'),
  ('Qatar', '+974'), ('Kuwait', '+965'), ('Bahrain', '+973'),
  ('Oman', '+968'), ('Bangladesh', '+880'), ('Malaysia', '+60'),
  ('Germany', '+49'), ('France', '+33'), ('Netherlands', '+31'),
  ('Belgium', '+32'), ('Sweden', '+46'), ('Norway', '+47'),
  ('Denmark', '+45'), ('Turkey', '+90'), ('Egypt', '+20'),
  ('South Africa', '+27'), ('Nigeria', '+234'), ('Kenya', '+254')
ON CONFLICT DO NOTHING;

-- Phone normalization function
CREATE OR REPLACE FUNCTION public.normalize_phone(raw_phone TEXT, p_country TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dial TEXT;
  _cleaned TEXT;
  _dial_digits TEXT;
BEGIN
  IF raw_phone IS NULL OR trim(raw_phone) = '' THEN RETURN NULL; END IF;

  _cleaned := regexp_replace(trim(raw_phone), '[^\d+]', '', 'g');

  IF _cleaned LIKE '+%' THEN RETURN _cleaned; END IF;

  SELECT dial_code INTO _dial
  FROM public.country_dial_codes
  WHERE lower(trim(country_dial_codes.country)) = lower(trim(p_country))
  LIMIT 1;

  IF _dial IS NULL THEN RETURN _cleaned; END IF;

  _cleaned := regexp_replace(_cleaned, '^0+', '');

  _dial_digits := regexp_replace(_dial, '[^\d]', '', 'g');
  IF starts_with(_cleaned, _dial_digits) THEN
    _cleaned := substring(_cleaned FROM length(_dial_digits) + 1);
  END IF;

  RETURN _dial || _cleaned;
END;
$$;

-- Trigger to auto-normalize whatsapp_number on profiles
CREATE OR REPLACE FUNCTION public.fn_normalize_profile_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.whatsapp_number IS NOT NULL AND NEW.country IS NOT NULL THEN
    NEW.whatsapp_number := public.normalize_phone(NEW.whatsapp_number, NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_profile_phone ON public.profiles;
CREATE TRIGGER trg_normalize_profile_phone
  BEFORE INSERT OR UPDATE OF whatsapp_number, country ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_profile_phone();

-- Update matching trigger to normalize phone before lookup
CREATE OR REPLACE FUNCTION public.fn_auto_match_submission_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _email TEXT;
  _phone TEXT;
  _country TEXT;
  _profile_id UUID;
BEGIN
  _email := lower(trim(NEW.data->>'email'));
  _phone := trim(NEW.data->>'phone');
  _country := trim(NEW.data->>'country');
  
  IF _phone IS NULL OR _phone = '' THEN
    _phone := trim(NEW.data->>'whatsapp');
  END IF;

  IF _phone IS NOT NULL AND _phone <> '' AND _country IS NOT NULL AND _country <> '' THEN
    _phone := public.normalize_phone(_phone, _country);
  END IF;

  IF _email IS NOT NULL AND _email <> '' THEN
    SELECT id INTO _profile_id
    FROM public.profiles
    WHERE lower(email) = _email
    LIMIT 1;
    
    IF _profile_id IS NOT NULL THEN
      NEW.matched_profile_id := _profile_id;
      NEW.match_status := 'matched_existing';
      NEW.match_confidence := 'exact_email';
      RETURN NEW;
    END IF;
  END IF;

  IF _phone IS NOT NULL AND _phone <> '' THEN
    SELECT id INTO _profile_id
    FROM public.profiles
    WHERE whatsapp_number = _phone
    LIMIT 1;
    
    IF _profile_id IS NOT NULL THEN
      NEW.matched_profile_id := _profile_id;
      NEW.match_status := 'matched_existing';
      NEW.match_confidence := 'exact_phone';
      RETURN NEW;
    END IF;
    
    SELECT p.id INTO _profile_id
    FROM public.profiles p
    JOIN public.student_parent_links spl ON spl.parent_id = p.id
    WHERE p.whatsapp_number = _phone
    LIMIT 1;
    
    IF _profile_id IS NOT NULL THEN
      NEW.matched_profile_id := _profile_id;
      NEW.match_status := 'matched_parent';
      NEW.match_confidence := 'exact_phone';
      RETURN NEW;
    END IF;
  END IF;

  NEW.match_status := 'new_contact';
  RETURN NEW;
END;
$function$;
