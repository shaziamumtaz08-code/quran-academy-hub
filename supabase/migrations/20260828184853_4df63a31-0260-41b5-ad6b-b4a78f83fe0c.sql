CREATE OR REPLACE FUNCTION public.can_read_tutorial_capture(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.tutorial_videos tv
      WHERE tv.is_published = true
        AND (
          tv.walkthrough_video_path = _object_name
          OR tv.walkthrough_poster_path = _object_name
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(tv.walkthrough_frames, '[]'::jsonb)) AS f
            WHERE f->>'path' = _object_name
          )
        )
        AND (
          tv.visible_roles IS NULL
          OR array_length(tv.visible_roles, 1) IS NULL
          OR EXISTS (
            SELECT 1
            FROM unnest(tv.visible_roles) AS r
            WHERE has_role(auth.uid(), r::app_role)
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_tutorial_capture(text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_read_tutorial_capture(text) TO authenticated, service_role;

DROP POLICY IF EXISTS tutorial_captures_read_authenticated ON storage.objects;

CREATE POLICY tutorial_captures_read_scoped
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tutorial-captures'
  AND public.can_read_tutorial_capture(name)
);