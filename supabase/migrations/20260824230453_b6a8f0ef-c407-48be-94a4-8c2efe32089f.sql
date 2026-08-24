CREATE OR REPLACE FUNCTION public.fn_quiz_collab_token_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.invite_token := encode(gen_random_bytes(32), 'hex');
    NEW.accepted_at := NULL;
  ELSE
    -- Token is server-issued and immutable; acceptance happens only via accept_quiz_invite()
    NEW.invite_token := OLD.invite_token;
  END IF;
  RETURN NEW;
END;
$$;