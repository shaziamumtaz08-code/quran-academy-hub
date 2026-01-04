-- Allow creating student/parent profiles without requiring an auth account
-- (Fixes bulk imports where multiple people share the same email)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make standalone profile creation easier (admin/teachers can still explicitly set id)
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();