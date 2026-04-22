-- Delete admin@admin.com: has user_context but no user_roles, no URN, no activity
-- Safe hard delete (not a super_admin grant)

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'admin@admin.com not found, skipping';
    RETURN;
  END IF;

  DELETE FROM public.user_context WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RAISE NOTICE 'Deleted admin@admin.com (id: %)', target_user_id;
END $$;