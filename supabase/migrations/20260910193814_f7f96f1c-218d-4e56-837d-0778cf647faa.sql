
REVOKE SELECT (whatsapp_number, emergency_contact_name) ON public.profiles FROM authenticated;

DROP FUNCTION IF EXISTS public.get_my_sensitive_profile();
DROP FUNCTION IF EXISTS public.admin_get_sensitive_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_my_sensitive_profile()
 RETURNS TABLE(gov_id_number text, gov_id_type text, gov_id_doc_url text, bank_name text, bank_account_number text, bank_account_title text, bank_iban text, emergency_contact_phone text, emergency_contact_name text, address text, whatsapp_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT gov_id_number, gov_id_type, gov_id_doc_url,
         bank_name, bank_account_number, bank_account_title, bank_iban,
         emergency_contact_phone, emergency_contact_name, address, whatsapp_number
  FROM public.profiles WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_sensitive_profile(_user_id uuid)
 RETURNS TABLE(gov_id_number text, gov_id_type text, gov_id_doc_url text, bank_name text, bank_account_number text, bank_account_title text, bank_iban text, emergency_contact_phone text, emergency_contact_name text, address text, whatsapp_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.gov_id_number, p.gov_id_type, p.gov_id_doc_url,
         p.bank_name, p.bank_account_number, p.bank_account_title, p.bank_iban,
         p.emergency_contact_phone, p.emergency_contact_name, p.address, p.whatsapp_number
  FROM public.profiles p WHERE p.id = _user_id;
END;
$function$;
