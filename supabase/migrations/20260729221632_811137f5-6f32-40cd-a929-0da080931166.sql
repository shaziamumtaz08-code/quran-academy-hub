CREATE OR REPLACE FUNCTION public.demo_chat_guard(_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _clean text := _text;
  _reasons text[] := '{}';
  _lower text := lower(_text);
  _kw text;
BEGIN
  IF _clean ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' THEN
    _reasons := array_append(_reasons, 'email');
    _clean := regexp_replace(_clean, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[hidden]', 'g');
  END IF;

  IF _clean ~* '(https?://|www\.|wa\.me|t\.me)' THEN
    _reasons := array_append(_reasons, 'link');
    _clean := regexp_replace(_clean, '(https?://\S+|www\.\S+|wa\.me/\S+|t\.me/\S+)', '[hidden]', 'gi');
  END IF;

  IF _clean ~ '(\+?\d[\d\s().-]{6,}\d)' THEN
    _reasons := array_append(_reasons, 'phone');
    _clean := regexp_replace(_clean, '(\+?\d[\d\s().-]{6,}\d)', '[hidden]', 'g');
  END IF;

  FOREACH _kw IN ARRAY ARRAY['whatsapp','telegram','snapchat','instagram','imo','skype me','fee','fees','discount','price','payment','paypal','bank account','easypaisa','jazzcash'] LOOP
    IF position(_kw in _lower) > 0 THEN
      _reasons := array_append(_reasons, _kw);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'clean', _clean,
    'flagged', array_length(_reasons, 1) IS NOT NULL,
    'reasons', to_jsonb(COALESCE(_reasons, '{}'::text[]))
  );
END;
$$;