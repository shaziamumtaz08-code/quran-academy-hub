
-- ============================================================
-- SECURITY FIX 1: course_quiz_questions - hide correct_answer from students
-- Drop the student SELECT policy that leaked correct_answer to any student
-- with an attempt row. Client code does NOT read course_quiz_questions
-- directly (verified); students go through grade-quiz-attempt edge function
-- and the quiz_banks/quiz_attempts subsystem.
-- ============================================================
DROP POLICY IF EXISTS "Student can view quiz questions when attempting"
  ON public.course_quiz_questions;

-- Provide a safe SECURITY DEFINER accessor if any future client code needs
-- to render questions to a student without exposing the answer.
CREATE OR REPLACE FUNCTION public.get_course_quiz_questions_for_student(_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question_text text,
  question_type text,
  options jsonb,
  points numeric,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.quiz_id, q.question_text, q.question_type, q.options, q.points, q.sort_order
  FROM public.course_quiz_questions q
  WHERE q.quiz_id = _quiz_id
    AND has_role(auth.uid(), 'student'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.course_quiz_attempts a
      WHERE a.quiz_id = _quiz_id AND a.student_id = auth.uid()
    )
  ORDER BY q.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_quiz_questions_for_student(uuid) TO authenticated;

-- ============================================================
-- SECURITY FIX 2: profiles - move sensitive fields to a locked-down table
-- Splits bank/gov-id/emergency/dob/whatsapp out of profiles so classmate,
-- teacher, and parent SELECT policies on profiles can no longer leak them.
-- Original columns on profiles are preserved (extend-only rule), but
-- SELECT on those columns is revoked from anon and authenticated so the
-- Data API can no longer return them. Admin and self read/write moves to
-- the new profile_sensitive_data table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profile_sensitive_data (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_number text,
  bank_iban text,
  gov_id_number text,
  gov_id_doc_url text,
  emergency_contact_phone text,
  whatsapp_number text,
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_sensitive_data TO authenticated;
GRANT ALL ON public.profile_sensitive_data TO service_role;

ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Self: read/update own row
CREATE POLICY "Users can view own sensitive data"
  ON public.profile_sensitive_data FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sensitive data"
  ON public.profile_sensitive_data FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sensitive data"
  ON public.profile_sensitive_data FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin/super_admin: full access
CREATE POLICY "Admins manage all sensitive data"
  ON public.profile_sensitive_data FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_profile_sensitive_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profile_sensitive_updated_at ON public.profile_sensitive_data;
CREATE TRIGGER trg_profile_sensitive_updated_at
  BEFORE UPDATE ON public.profile_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_sensitive_updated_at();

-- Backfill from profiles (one-time)
INSERT INTO public.profile_sensitive_data (
  user_id, bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
  emergency_contact_phone, whatsapp_number, date_of_birth
)
SELECT id, bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
       emergency_contact_phone, whatsapp_number, date_of_birth
FROM public.profiles
WHERE bank_account_number IS NOT NULL
   OR bank_iban IS NOT NULL
   OR gov_id_number IS NOT NULL
   OR gov_id_doc_url IS NOT NULL
   OR emergency_contact_phone IS NOT NULL
   OR whatsapp_number IS NOT NULL
   OR date_of_birth IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Mirror trigger: when the legacy columns on profiles are written to by
-- existing app code, propagate the values into profile_sensitive_data.
-- This keeps writes working during the client transition; reads must
-- migrate to profile_sensitive_data because SELECT is revoked below.
CREATE OR REPLACE FUNCTION public.mirror_profile_sensitive_to_new_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bank_account_number IS NOT NULL
     OR NEW.bank_iban IS NOT NULL
     OR NEW.gov_id_number IS NOT NULL
     OR NEW.gov_id_doc_url IS NOT NULL
     OR NEW.emergency_contact_phone IS NOT NULL
     OR NEW.whatsapp_number IS NOT NULL
     OR NEW.date_of_birth IS NOT NULL THEN
    INSERT INTO public.profile_sensitive_data (
      user_id, bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
      emergency_contact_phone, whatsapp_number, date_of_birth
    ) VALUES (
      NEW.id, NEW.bank_account_number, NEW.bank_iban, NEW.gov_id_number, NEW.gov_id_doc_url,
      NEW.emergency_contact_phone, NEW.whatsapp_number, NEW.date_of_birth
    )
    ON CONFLICT (user_id) DO UPDATE SET
      bank_account_number     = COALESCE(EXCLUDED.bank_account_number,     profile_sensitive_data.bank_account_number),
      bank_iban               = COALESCE(EXCLUDED.bank_iban,               profile_sensitive_data.bank_iban),
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
  AFTER INSERT OR UPDATE OF bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
                            emergency_contact_phone, whatsapp_number, date_of_birth
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mirror_profile_sensitive_to_new_table();

-- Column-level lockdown on profiles: revoke SELECT on sensitive columns
-- from anon and authenticated. Data API can no longer return these columns
-- to classmates, teachers, or parents via the RLS-permitted rows. Reads
-- must go through public.profile_sensitive_data (RLS: self+admin).
REVOKE SELECT (bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
               emergency_contact_phone, whatsapp_number, date_of_birth)
  ON public.profiles FROM anon;
REVOKE SELECT (bank_account_number, bank_iban, gov_id_number, gov_id_doc_url,
               emergency_contact_phone, whatsapp_number, date_of_birth)
  ON public.profiles FROM authenticated;

-- ============================================================
-- SECURITY FIX 3: storage.objects - restrict ticket-attachments uploads
-- Old policy allowed any authenticated user to upload into any ticket
-- folder. Replace with a policy that mirrors the SELECT rule: uploader
-- must be admin, participant, or watcher of the target ticket UUID
-- (encoded as the first path segment / folder name).
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload ticket attachments"
  ON storage.objects;

CREATE POLICY "Ticket attachments: participants only upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (
      is_admin(auth.uid())
      OR is_super_admin(auth.uid())
      OR is_ticket_participant(((storage.foldername(name))[1])::uuid, auth.uid())
      OR is_ticket_watcher(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
