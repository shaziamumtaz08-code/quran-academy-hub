
INSERT INTO public.library_categories (name, slug, icon, color, visibility_default, sort_order) VALUES
  ('General',    'general',    'FolderOpen', '#64748b', 'all', 0),
  ('Lessons',    'lessons',    'BookOpen',   '#3b82f6', 'all', 1),
  ('Worksheets', 'worksheets', 'FileText',   '#10b981', 'all', 2),
  ('Audio',      'audio',      'Music',      '#a855f7', 'all', 3),
  ('Videos',     'videos',     'Video',      '#ef4444', 'all', 4),
  ('Links',      'links',      'Link',       '#f59e0b', 'all', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.library_items
  (title, description, category_id, type, url, file_path, tags, visibility, visible_to_roles, uploaded_by, created_at, updated_at)
SELECT
  r.title,
  NULL,
  COALESCE(
    (SELECT id FROM public.library_categories WHERE slug = CASE
      WHEN r.type = 'link'  THEN 'links'
      WHEN r.type = 'audio' THEN 'audio'
      WHEN r.type = 'video' THEN 'videos'
      WHEN lower(coalesce(r.folder,'')) LIKE '%lesson%' THEN 'lessons'
      WHEN lower(coalesce(r.folder,'')) LIKE '%worksheet%' THEN 'worksheets'
      ELSE 'general'
    END LIMIT 1),
    (SELECT id FROM public.library_categories WHERE slug = 'general' LIMIT 1)
  ),
  r.type,
  CASE WHEN r.type = 'link' THEN r.url ELSE NULL END,
  CASE WHEN r.type = 'link' THEN NULL ELSE r.url END,
  CASE
    WHEN r.tags IS NULL OR r.tags = '' THEN '{}'::text[]
    ELSE string_to_array(r.tags, ',')
  END,
  COALESCE(r.visibility, 'all'),
  COALESCE(r.visible_to_roles, '{}'),
  r.uploaded_by,
  r.created_at,
  r.updated_at
FROM public.resources r
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.title = r.title
      AND COALESCE(li.file_path, li.url) = r.url
  );
