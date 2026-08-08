REVOKE SELECT (date_of_birth, bank_account_title) ON public.profiles FROM authenticated;
REVOKE SELECT (date_of_birth, bank_account_title) ON public.profiles FROM anon;

DROP FUNCTION IF EXISTS public.get_profile_wellbeing(uuid);

CREATE OR REPLACE FUNCTION public.get_profile_wellbeing(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  blood_group text,
  medical_conditions text,
  medical_notes text,
  father_contact text,
  mother_contact text,
  emergency_contact_phone text,
  date_of_birth date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.blood_group, p.medical_conditions, p.medical_notes,
         p.father_contact, p.mother_contact, p.emergency_contact_phone,
         p.date_of_birth
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (
      auth.uid() = _user_id
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.student_parent_links spl
        WHERE spl.student_id = _user_id AND spl.parent_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.student_teacher_assignments sta
        WHERE sta.student_id = _user_id AND sta.teacher_id = auth.uid()
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.get_profile_wellbeing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_wellbeing(uuid) TO authenticated;