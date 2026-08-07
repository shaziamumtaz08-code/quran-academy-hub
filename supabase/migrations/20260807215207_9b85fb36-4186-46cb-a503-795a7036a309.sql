REVOKE SELECT (blood_group, medical_conditions, medical_notes, father_contact, mother_contact, emergency_contact_phone)
  ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_profile_wellbeing(_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  blood_group text,
  medical_conditions text,
  medical_notes text,
  father_contact text,
  mother_contact text,
  emergency_contact_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.blood_group, p.medical_conditions, p.medical_notes,
         p.father_contact, p.mother_contact, p.emergency_contact_phone
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
    );
$$;

REVOKE ALL ON FUNCTION public.get_profile_wellbeing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_wellbeing(uuid) TO authenticated, service_role;