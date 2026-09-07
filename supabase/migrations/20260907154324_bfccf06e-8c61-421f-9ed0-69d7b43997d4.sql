REVOKE SELECT (blood_group, medical_conditions, medical_notes) ON public.profiles FROM authenticated;
REVOKE SELECT (blood_group, medical_conditions, medical_notes) ON public.profiles FROM anon;