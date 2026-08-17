CREATE OR REPLACE FUNCTION public.fn_demo_session_generate_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.teacher_share_token IS NULL THEN
    NEW.teacher_share_token := encode(extensions.gen_random_bytes(16), 'hex');
  END IF;
  IF NEW.student_share_token IS NULL THEN
    NEW.student_share_token := encode(extensions.gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;