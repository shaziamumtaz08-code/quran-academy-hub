ALTER TABLE public.course_classes
  ADD COLUMN IF NOT EXISTS zoom_account_id uuid REFERENCES public.zoom_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_classes_zoom_account_id ON public.course_classes(zoom_account_id);

ALTER TABLE public.zoom_accounts
  ADD COLUMN IF NOT EXISTS zoom_meeting_sdk_client_id text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_sdk_client_secret text;

CREATE OR REPLACE FUNCTION public.admin_set_zoom_meeting_sdk_creds(
  _account_id uuid,
  _client_id text,
  _client_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.zoom_accounts
     SET zoom_meeting_sdk_client_id = NULLIF(btrim(_client_id), ''),
         zoom_meeting_sdk_client_secret = NULLIF(btrim(_client_secret), ''),
         updated_at = now()
   WHERE id = _account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_zoom_meeting_sdk_creds(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_zoom_meeting_sdk_creds(uuid, text, text) TO authenticated;