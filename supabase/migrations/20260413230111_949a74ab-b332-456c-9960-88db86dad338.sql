
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

  -- Try phone match on profiles.whatsapp_number
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
    
    -- Check parent links
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
$$;
