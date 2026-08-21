CREATE OR REPLACE FUNCTION public.register_push_token(_token text, _device_info jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _token IS NULL OR length(_token) < 10 THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  -- A device token belongs to exactly one account: release it from any prior owner.
  DELETE FROM public.push_tokens WHERE token = _token AND user_id <> auth.uid();

  INSERT INTO public.push_tokens (user_id, token, device_info, updated_at)
  VALUES (auth.uid(), _token, COALESCE(_device_info, '{}'::jsonb), now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        device_info = EXCLUDED.device_info,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, jsonb) TO authenticated;