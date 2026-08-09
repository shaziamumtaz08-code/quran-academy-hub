CREATE TABLE IF NOT EXISTS public.tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  source_type text NOT NULL DEFAULT 'link' CHECK (source_type IN ('link','upload')),
  video_url text NOT NULL,
  storage_path text,
  thumbnail_url text,
  duration_seconds integer,
  visible_roles text[] NOT NULL DEFAULT ARRAY['admin','super_admin','teacher','student','parent'],
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_videos TO authenticated;
GRANT ALL ON public.tutorial_videos TO service_role;

ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorials_read_published" ON public.tutorial_videos
AS PERMISSIVE FOR SELECT TO authenticated
USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tutorials_admin_manage" ON public.tutorial_videos
AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_tutorial_videos_updated_at
BEFORE UPDATE ON public.tutorial_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tutorial_videos_sort ON public.tutorial_videos (category, sort_order);