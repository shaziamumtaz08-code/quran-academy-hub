ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS father_contact text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS mother_contact text;

GRANT SELECT (father_name, father_contact, mother_name, mother_contact) ON public.profiles TO authenticated;