
-- 1. app_settings: explicit is_public flag
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
UPDATE public.app_settings SET is_public = true WHERE setting_key IN ('featured_spotlight','default_signup_context');

DROP POLICY IF EXISTS "Authenticated users can view public settings" ON public.app_settings;
CREATE POLICY "Authenticated users can view public settings"
ON public.app_settings FOR SELECT TO authenticated
USING (is_public = true);

-- 2. exams: examiner insert must be self-attributed and for a real student
DROP POLICY IF EXISTS "Examiner can insert exams" ON public.exams;
CREATE POLICY "Examiner can insert exams"
ON public.exams FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'examiner'::app_role)
  AND examiner_id = auth.uid()
  AND public.has_role(student_id, 'student'::app_role)
);

-- 3. family_registrations: DB-level throttle for public intake
CREATE OR REPLACE FUNCTION public.fn_throttle_family_registrations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_hour int;
  recent_day int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_hour
  FROM public.family_registrations fr
  WHERE fr.created_at > now() - interval '1 hour'
    AND (
      (NEW.email IS NOT NULL AND lower(fr.email) = lower(NEW.email))
      OR (NEW.phone IS NOT NULL AND fr.phone = NEW.phone)
    );

  IF recent_hour >= 3 THEN
    RAISE EXCEPTION 'Too many registration submissions. Please try again later.';
  END IF;

  SELECT count(*) INTO recent_day
  FROM public.family_registrations fr
  WHERE fr.created_at > now() - interval '1 day'
    AND (
      (NEW.email IS NOT NULL AND lower(fr.email) = lower(NEW.email))
      OR (NEW.phone IS NOT NULL AND fr.phone = NEW.phone)
    );

  IF recent_day >= 10 THEN
    RAISE EXCEPTION 'Too many registration submissions. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_throttle_family_registrations ON public.family_registrations;
CREATE TRIGGER trg_throttle_family_registrations
BEFORE INSERT ON public.family_registrations
FOR EACH ROW EXECUTE FUNCTION public.fn_throttle_family_registrations();

-- 4. quiz_attempts: guest email must be well formed and not an existing account
CREATE OR REPLACE FUNCTION public.guest_email_is_unclaimed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _email IS NOT NULL
    AND char_length(_email) <= 254
    AND _email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.email) = lower(_email)
    );
$$;

DROP POLICY IF EXISTS "Anon insert public attempts" ON public.quiz_attempts;
CREATE POLICY "Anon insert public attempts"
ON public.quiz_attempts FOR INSERT TO anon
WITH CHECK (
  student_id IS NULL
  AND guest_email IS NOT NULL
  AND session_id IS NOT NULL
  AND public.guest_email_is_unclaimed(guest_email)
  AND public.quiz_session_is_open(session_id, quiz_bank_id)
);
