
-- Add match columns
ALTER TABLE public.registration_submissions
  ADD COLUMN IF NOT EXISTS matched_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'new_contact'
    CHECK (match_status IN ('new_contact', 'matched_existing', 'matched_parent')),
  ADD COLUMN IF NOT EXISTS match_confidence TEXT DEFAULT NULL
    CHECK (match_confidence IN ('exact_email', 'exact_phone', 'fuzzy_name_phone'));

CREATE INDEX IF NOT EXISTS idx_reg_submissions_matched_profile ON public.registration_submissions(matched_profile_id);
CREATE INDEX IF NOT EXISTS idx_reg_submissions_match_status ON public.registration_submissions(match_status);

-- Auto-match trigger function
CREATE OR REPLACE FUNCTION public.fn_auto_match_submission_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email TEXT;
  _phone TEXT;
  _profile_id UUID;
BEGIN
  _email := lower(trim(NEW.data->>'email'));
  _phone := trim(NEW.data->>'phone');
  
  -- If phone is empty, try whatsapp field
  IF _phone IS NULL OR _phone = '' THEN
    _phone := trim(NEW.data->>'whatsapp');
  END IF;

  -- Try exact email match first
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

  -- Try phone match on profiles
  IF _phone IS NOT NULL AND _phone <> '' THEN
    SELECT id INTO _profile_id
    FROM public.profiles
    WHERE phone = _phone OR whatsapp_number = _phone
    LIMIT 1;
    
    IF _profile_id IS NOT NULL THEN
      NEW.matched_profile_id := _profile_id;
      NEW.match_status := 'matched_existing';
      NEW.match_confidence := 'exact_phone';
      RETURN NEW;
    END IF;
    
    -- Check student_parent_links via parent profile phone
    SELECT p.id INTO _profile_id
    FROM public.profiles p
    JOIN public.student_parent_links spl ON spl.parent_id = p.id
    WHERE p.phone = _phone OR p.whatsapp_number = _phone
    LIMIT 1;
    
    IF _profile_id IS NOT NULL THEN
      NEW.matched_profile_id := _profile_id;
      NEW.match_status := 'matched_parent';
      NEW.match_confidence := 'exact_phone';
      RETURN NEW;
    END IF;
  END IF;

  -- No match
  NEW.match_status := 'new_contact';
  RETURN NEW;
END;
$$;

-- Create trigger (BEFORE INSERT so we can modify NEW)
DROP TRIGGER IF EXISTS trg_auto_match_submission ON public.registration_submissions;
CREATE TRIGGER trg_auto_match_submission
  BEFORE INSERT ON public.registration_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_match_submission_to_profile();
