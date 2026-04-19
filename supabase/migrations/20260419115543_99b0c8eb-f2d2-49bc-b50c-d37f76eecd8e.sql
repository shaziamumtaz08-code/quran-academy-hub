-- Add guardian_type to profiles to support holistic student profile guardian logic
DO $$ BEGIN
  CREATE TYPE public.guardian_type_enum AS ENUM ('none', 'parent', 'guardian', 'emergency_contact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guardian_type public.guardian_type_enum,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS learning_goals text,
  ADD COLUMN IF NOT EXISTS special_needs text,
  ADD COLUMN IF NOT EXISTS hear_about_us text,
  ADD COLUMN IF NOT EXISTS arabic_level text,
  ADD COLUMN IF NOT EXISTS first_language text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS preferred_contact_method text,
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS gov_id_verified_by uuid,
  ADD COLUMN IF NOT EXISTS gov_id_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_password_reset boolean DEFAULT false;

-- Backfill guardian_type for existing student profiles based on age + parent links
UPDATE public.profiles p
SET guardian_type = CASE
  WHEN EXISTS (SELECT 1 FROM public.student_parent_links spl WHERE spl.student_id = p.id) THEN 'parent'::public.guardian_type_enum
  WHEN p.age IS NOT NULL AND p.age >= 17 THEN 'none'::public.guardian_type_enum
  ELSE NULL
END
WHERE p.guardian_type IS NULL;