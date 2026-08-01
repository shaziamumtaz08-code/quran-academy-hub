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
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  UPDATE public.profiles SET onboarding_token = tok WHERE id = _teacher_id;
  RETURN tok;
END;
$$;