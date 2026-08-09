ALTER TABLE public.tutorial_videos
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkthrough_video_path text,
  ADD COLUMN IF NOT EXISTS walkthrough_poster_path text;

CREATE OR REPLACE FUNCTION public.get_shared_walkthrough(_token text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  video_path text,
  poster_path text,
  duration_seconds integer,
  walkthrough_frames jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.title, t.description, t.category,
         t.walkthrough_video_path, t.walkthrough_poster_path,
         t.duration_seconds, t.walkthrough_frames
  FROM public.tutorial_videos t
  WHERE t.share_token = _token
    AND t.share_enabled = true
    AND t.walkthrough_video_path IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_walkthrough(text) TO anon, authenticated;