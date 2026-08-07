-- 1) Library share tokens: expiry + revocation
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;

-- Backfill expiry for existing tokens (30 days from now)
UPDATE public.library_items
   SET share_token_expires_at = now() + interval '30 days'
 WHERE share_token IS NOT NULL AND share_token_expires_at IS NULL;

DROP POLICY IF EXISTS "public read by matching share token" ON public.library_items;
CREATE POLICY "public read by matching unexpired share token"
ON public.library_items
FOR SELECT
TO anon
USING (
  share_token IS NOT NULL
  AND length(share_token) >= 32
  AND share_token_expires_at IS NOT NULL
  AND share_token_expires_at > now()
  AND share_token = ((current_setting('request.headers', true))::json ->> 'x-share-token')
);

-- Stronger tokens, expiry, and an authorization check before minting a link
CREATE OR REPLACE FUNCTION public.library_ensure_share_token(_item_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Regenerate when missing, weak, or expired
  IF _tok IS NULL OR length(_tok) < 32 OR _exp IS NULL OR _exp <= now() THEN
    _tok := encode(gen_random_bytes(32), 'hex');
    _exp := now() + interval '30 days';
    UPDATE public.library_items
       SET share_token = _tok,
           share_token_expires_at = _exp
     WHERE id = _item_id;
  END IF;

  RETURN _tok;
END;
$function$;

-- 2) app_settings: keep the allow-list explicit and documented
DROP POLICY IF EXISTS "Authenticated users can view public settings" ON public.app_settings;
CREATE POLICY "Authenticated users can view public settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (setting_key = ANY (ARRAY['featured_spotlight'::text, 'default_signup_context'::text]));

COMMENT ON POLICY "Authenticated users can view public settings" ON public.app_settings IS
  'SECURITY: strict allow-list of non-sensitive setting keys. Never add a key here without a security review; all other settings remain admin-only.';
COMMENT ON COLUMN public.app_settings.setting_key IS
  'SECURITY: only keys explicitly allow-listed in the "Authenticated users can view public settings" policy are readable by non-admins. Never store secrets in this table.';

-- 3) Resource visibility: explicit deny for unauthenticated callers
CREATE OR REPLACE FUNCTION public.can_view_resource_visibility(_visibility text, _visible_to_roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  -- Deny anonymous / unauthenticated access outright
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF is_admin(_user_id) OR is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF _visibility IS NULL OR _visibility = 'admin_only' THEN
    RETURN false;
  END IF;

  IF _visibility = 'all' THEN
    RETURN true;
  END IF;

  IF _visibility = 'teachers' AND has_role(_user_id, 'teacher') THEN
    RETURN true;
  END IF;

  IF _visibility = 'students' AND has_role(_user_id, 'student') THEN
    RETURN true;
  END IF;

  IF _visibility = 'custom' AND _visible_to_roles IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role::text = ANY (_visible_to_roles)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_resource_visibility(_visibility text, _visible_to_roles text[], _visible_to_user_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF is_admin(_user_id) OR is_super_admin(_user_id) THEN RETURN true; END IF;
  IF _visibility = 'admin_only' THEN RETURN false; END IF;
  IF _visible_to_user_ids IS NOT NULL AND _user_id = ANY(_visible_to_user_ids) THEN RETURN true; END IF;
  RETURN public.can_view_resource_visibility(_visibility, _visible_to_roles);
END; $function$;