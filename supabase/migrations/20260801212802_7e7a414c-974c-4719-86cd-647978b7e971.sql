ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS school_name text,
  ADD COLUMN IF NOT EXISTS grade_level text;

GRANT SELECT (blood_group, medical_conditions, medical_notes, school_name, grade_level) ON public.profiles TO authenticated;
GRANT UPDATE (blood_group, medical_conditions, medical_notes, school_name, grade_level) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_generate_student_onboarding_token(_student_id uuid)
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
  UPDATE public.profiles SET onboarding_token = tok WHERE id = _student_id;
  RETURN tok;
END;
$$;