
-- Add identity verification fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gov_id_type text,
  ADD COLUMN IF NOT EXISTS gov_id_number text,
  ADD COLUMN IF NOT EXISTS gov_id_doc_url text,
  ADD COLUMN IF NOT EXISTS gov_id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gov_id_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS gov_id_verified_by uuid;

-- Constrain ID type to known values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gov_id_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gov_id_type_check
  CHECK (gov_id_type IS NULL OR gov_id_type IN ('CNIC','Passport','Iqama','NID','Other'));

-- Unique gov_id_number where not null (case-insensitive, trimmed)
DROP INDEX IF EXISTS public.profiles_gov_id_number_unique;
CREATE UNIQUE INDEX profiles_gov_id_number_unique
  ON public.profiles (lower(trim(gov_id_number)))
  WHERE gov_id_number IS NOT NULL AND trim(gov_id_number) <> '';

-- Helper to find existing profile by gov_id (used during registration)
CREATE OR REPLACE FUNCTION public.find_profile_by_gov_id(_gov_id text)
RETURNS TABLE(id uuid, full_name text, email text, gov_id_verified boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.gov_id_verified
  FROM public.profiles p
  WHERE _gov_id IS NOT NULL
    AND trim(_gov_id) <> ''
    AND lower(trim(p.gov_id_number)) = lower(trim(_gov_id))
  LIMIT 1;
$$;

-- Storage bucket for identity documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for identity-documents bucket
DROP POLICY IF EXISTS "Users upload own identity docs" ON storage.objects;
CREATE POLICY "Users upload own identity docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users view own identity docs" ON storage.objects;
CREATE POLICY "Users view own identity docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Admins update identity docs" ON storage.objects;
CREATE POLICY "Admins update identity docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Admins delete identity docs" ON storage.objects;
CREATE POLICY "Admins delete identity docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity-documents'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);
