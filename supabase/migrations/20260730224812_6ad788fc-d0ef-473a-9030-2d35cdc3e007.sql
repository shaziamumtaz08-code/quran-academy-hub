DO $$ BEGIN
  CREATE TYPE public.banking_verify_status AS ENUM ('not_provided','pending','verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cv_review_status AS ENUM ('not_provided','pending','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS years_experience numeric,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS cv_url text,
  ADD COLUMN IF NOT EXISTS cv_file_name text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cv_status public.cv_review_status NOT NULL DEFAULT 'not_provided',
  ADD COLUMN IF NOT EXISTS banking_status public.banking_verify_status NOT NULL DEFAULT 'not_provided',
  ADD COLUMN IF NOT EXISTS zoom_personal_id text,
  ADD COLUMN IF NOT EXISTS zoom_email text,
  ADD COLUMN IF NOT EXISTS onboarding_token text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_onboarding_token_unique
  ON public.profiles (onboarding_token) WHERE onboarding_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_teacher_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := auth.uid() IS NULL
    OR public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid());

  IF NOT is_privileged AND NEW.id = auth.uid() THEN
    NEW.department      := OLD.department;
    NEW.designation     := OLD.designation;
    NEW.qualification   := OLD.qualification;
    NEW.specialization  := OLD.specialization;
    NEW.joining_date    := OLD.joining_date;
    NEW.employment_type := OLD.employment_type;
    NEW.onboarding_token := OLD.onboarding_token;
    NEW.banking_status  := OLD.banking_status;
    NEW.cv_status       := OLD.cv_status;

    IF NEW.cv_url IS DISTINCT FROM OLD.cv_url AND NEW.cv_url IS NOT NULL THEN
      NEW.cv_status := 'pending';
      NEW.cv_uploaded_at := now();
      INSERT INTO public.notification_queue (recipient_id, recipient_type, notification_type, title, message, metadata)
      SELECT ur.user_id, 'admin', 'teacher_cv_pending',
             'CV pending review',
             COALESCE(NEW.full_name,'A teacher') || ' uploaded a new CV for review.',
             jsonb_build_object('teacher_id', NEW.id)
      FROM public.user_roles ur
      WHERE ur.role IN ('admin','super_admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_teacher_profile_columns ON public.profiles;
CREATE TRIGGER trg_guard_teacher_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_columns();

CREATE OR REPLACE FUNCTION public.sync_banking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_data boolean;
  is_owner_edit boolean;
BEGIN
  has_data := COALESCE(NULLIF(TRIM(COALESCE(NEW.bank_account_number,'')), ''), NULLIF(TRIM(COALESCE(NEW.bank_iban,'')), '')) IS NOT NULL;
  is_owner_edit := auth.uid() IS NOT NULL
    AND auth.uid() = NEW.user_id
    AND NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

  IF NOT has_data THEN
    UPDATE public.profiles SET banking_status = 'not_provided' WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR is_owner_edit THEN
    UPDATE public.profiles SET banking_status = 'pending' WHERE id = NEW.user_id;
    INSERT INTO public.notification_queue (recipient_id, recipient_type, notification_type, title, message, metadata)
    SELECT ur.user_id, 'admin', 'teacher_banking_pending',
           'Banking details pending verification',
           COALESCE((SELECT full_name FROM public.profiles WHERE id = NEW.user_id), 'A teacher')
             || ' updated their banking details.',
           jsonb_build_object('teacher_id', NEW.user_id)
    FROM public.user_roles ur
    WHERE ur.role IN ('admin','super_admin');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_banking_status ON public.profile_sensitive_data;
CREATE TRIGGER trg_sync_banking_status
AFTER INSERT OR UPDATE OF bank_name, bank_account_title, bank_account_number, bank_iban
ON public.profile_sensitive_data
FOR EACH ROW EXECUTE FUNCTION public.sync_banking_status();

CREATE OR REPLACE FUNCTION public.admin_set_teacher_verification(
  _teacher_id uuid,
  _banking public.banking_verify_status DEFAULT NULL,
  _cv public.cv_review_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles
     SET banking_status = COALESCE(_banking, banking_status),
         cv_status = COALESCE(_cv, cv_status),
         updated_at = now()
   WHERE id = _teacher_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_generate_onboarding_token(_teacher_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  tok := encode(gen_random_bytes(24), 'hex');
  UPDATE public.profiles SET onboarding_token = tok WHERE id = _teacher_id;
  RETURN tok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_teacher_verification(uuid, public.banking_verify_status, public.cv_review_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_onboarding_token(uuid) TO authenticated;

DROP POLICY IF EXISTS "Teacher docs own read" ON storage.objects;
CREATE POLICY "Teacher docs own read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'teacher-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Teacher docs own write" ON storage.objects;
CREATE POLICY "Teacher docs own write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'teacher-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Teacher docs own update" ON storage.objects;
CREATE POLICY "Teacher docs own update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'teacher-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);