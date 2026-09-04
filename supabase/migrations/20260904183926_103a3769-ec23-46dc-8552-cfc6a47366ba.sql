REVOKE SELECT (
  blood_group, medical_conditions, medical_notes,
  bank_name, bank_account_number, bank_iban,
  gov_id_type, gov_id_number, gov_id_doc_url,
  emergency_contact_phone, father_contact, mother_contact, date_of_birth
) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_profile_wellbeing(_user_id uuid)
 RETURNS TABLE(user_id uuid, blood_group text, medical_conditions text, medical_notes text, father_contact text, mother_contact text, emergency_contact_phone text, date_of_birth date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
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
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.get_profile_wellbeing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_wellbeing(uuid) TO authenticated, service_role;