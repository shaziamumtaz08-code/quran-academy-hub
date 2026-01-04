-- Fix role assignment for imported profiles that don't have auth accounts
-- Change user_roles.user_id FK to reference public.profiles(id) instead of auth.users

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;