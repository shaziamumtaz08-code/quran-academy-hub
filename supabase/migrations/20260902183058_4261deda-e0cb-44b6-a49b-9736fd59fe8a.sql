-- 1) Recording passwords: remove column-level read access, issue on demand via RPC
REVOKE SELECT (recording_password) ON public.live_sessions FROM anon, authenticated;
REVOKE SELECT (password) ON public.session_recordings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_access_live_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = _session_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR ls.teacher_id = auth.uid()
        OR ls.student_id = auth.uid()
        OR ls.student_id IN (SELECT public.get_parent_children_ids(auth.uid()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_recording_passwords(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_live_session(_session_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'session_password', (SELECT ls.recording_password FROM public.live_sessions ls WHERE ls.id = _session_id),
    'recordings', COALESCE((
      SELECT jsonb_object_agg(sr.id::text, sr.password)
      FROM public.session_recordings sr
      WHERE sr.session_id = _session_id AND sr.password IS NOT NULL
    ), '{}'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recording_passwords(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_recording_passwords(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_live_session(uuid) TO authenticated;

-- 2) Registration uploads: scope anonymous writes to a per-submission folder
DROP POLICY IF EXISTS "Anyone can upload registration files" ON storage.objects;

CREATE POLICY "Public registration uploads are submission scoped"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'registration-uploads'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND array_length(storage.foldername(name), 1) = 2
);

CREATE POLICY "Users upload registration files to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'registration-uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] = 'submissions'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    OR is_admin(auth.uid())
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Users update own registration uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'registration-uploads'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'registration-uploads'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Users read own registration uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'registration-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Tutorial videos storage: mirror table-level publish/role checks
CREATE OR REPLACE FUNCTION public.can_read_tutorial_video(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.tutorial_videos tv
      WHERE tv.is_published = true
        AND (
          tv.storage_path = _object_name
          OR tv.walkthrough_video_path = _object_name
          OR tv.walkthrough_poster_path = _object_name
        )
        AND (
          tv.visible_roles IS NULL
          OR array_length(tv.visible_roles, 1) IS NULL
          OR EXISTS (
            SELECT 1 FROM unnest(tv.visible_roles) AS r
            WHERE has_role(auth.uid(), r::app_role)
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_tutorial_video(text) TO authenticated;

DROP POLICY IF EXISTS "tutorial_videos_read" ON storage.objects;

CREATE POLICY "tutorial_videos_read_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutorial-videos' AND public.can_read_tutorial_video(name));