CREATE OR REPLACE FUNCTION public.library_ensure_share_token(_item_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _tok text;
  _exp timestamptz;
  _uploader uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT share_token, share_token_expires_at, uploaded_by
    INTO _tok, _exp, _uploader
    FROM public.library_items
   WHERE id = _item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF NOT (is_admin(_uid) OR is_super_admin(_uid) OR _uploader = _uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _tok IS NULL OR length(_tok) < 32 OR _exp IS NULL OR _exp <= now() THEN
    _tok := encode(extensions.gen_random_bytes(32), 'hex');
    _exp := now() + interval '30 days';
    UPDATE public.library_items
       SET share_token = _tok,
           share_token_expires_at = _exp
     WHERE id = _item_id;
  END IF;

  RETURN _tok;
END;
$function$;