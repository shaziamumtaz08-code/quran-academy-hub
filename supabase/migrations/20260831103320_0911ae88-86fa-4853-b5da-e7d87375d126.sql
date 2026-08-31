ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES public.course_library_assets(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS library_items_source_asset_id_key
  ON public.library_items (source_asset_id)
  WHERE source_asset_id IS NOT NULL;