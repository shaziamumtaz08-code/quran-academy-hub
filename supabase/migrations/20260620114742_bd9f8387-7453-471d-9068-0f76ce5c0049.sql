
-- Extend library_items
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS publication_year int,
  ADD COLUMN IF NOT EXISTS edition text,
  ADD COLUMN IF NOT EXISTS isbn text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS pages_count int,
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS allow_downloads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downloads_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_library_items_featured ON public.library_items(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_library_items_status ON public.library_items(status);
CREATE INDEX IF NOT EXISTS idx_library_items_downloads ON public.library_items(downloads_count DESC);

-- Download log
CREATE TABLE IF NOT EXISTS public.library_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role text,
  ip_address text,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.library_download_events TO authenticated;
GRANT ALL ON public.library_download_events TO service_role;
ALTER TABLE public.library_download_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can insert their downloads" ON public.library_download_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admins can view all download events" ON public.library_download_events
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_lib_dl_events_item ON public.library_download_events(item_id);
CREATE INDEX IF NOT EXISTS idx_lib_dl_events_at ON public.library_download_events(downloaded_at DESC);

-- Increment helpers
CREATE OR REPLACE FUNCTION public.library_increment_view(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.library_items SET views_count = views_count + 1 WHERE id = _item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_log_download(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.library_download_events(item_id, user_id, user_role)
  VALUES (_item_id, auth.uid(), COALESCE(_role, 'guest'));
  UPDATE public.library_items SET downloads_count = downloads_count + 1 WHERE id = _item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.library_increment_view(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.library_log_download(uuid) TO authenticated;

-- Seed extra categories (skip if exists by slug)
INSERT INTO public.library_categories (name, slug, icon, color, visibility_default, sort_order)
VALUES
  ('E-Books',              'ebooks',              'BookOpen',    '#10b981', 'all', 10),
  ('Research Papers',      'research-papers',     'FileText',    '#3b82f6', 'all', 11),
  ('Textbooks',            'textbooks',           'BookMarked',  '#f59e0b', 'all', 12),
  ('Journals',             'journals',            'Newspaper',   '#8b5cf6', 'all', 13),
  ('Past Papers',          'past-papers',         'ClipboardList','#ef4444', 'all', 14),
  ('Lecture Notes',        'lecture-notes',       'StickyNote',  '#06b6d4', 'all', 15),
  ('Thesis & Dissertations','thesis',             'GraduationCap','#ec4899','all', 16),
  ('Reference Materials',  'reference',           'Library',     '#64748b', 'all', 17)
ON CONFLICT (slug) DO NOTHING;
