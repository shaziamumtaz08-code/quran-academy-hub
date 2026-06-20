
-- library_categories
CREATE TABLE public.library_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  color text,
  visibility_default text NOT NULL DEFAULT 'all',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_categories TO authenticated;
GRANT ALL ON public.library_categories TO service_role;

ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view library categories"
  ON public.library_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage library categories"
  ON public.library_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_library_categories_updated
  BEFORE UPDATE ON public.library_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- library_items
CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.library_categories(id) ON DELETE SET NULL,
  type text NOT NULL,
  url text,
  file_path text,
  thumbnail text,
  tags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'all',
  visible_to_roles text[] NOT NULL DEFAULT '{}',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_items_category ON public.library_items(category_id);
CREATE INDEX idx_library_items_uploaded_by ON public.library_items(uploaded_by);
CREATE INDEX idx_library_items_tags ON public.library_items USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View library items by visibility"
  ON public.library_items FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR visibility = 'all'
    OR (visibility = 'teachers' AND public.has_role(auth.uid(), 'teacher'::app_role))
    OR (visibility = 'students' AND public.has_role(auth.uid(), 'student'::app_role))
    OR (visible_to_roles IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(visible_to_roles)
    ))
  );

CREATE POLICY "Admins or uploader insert library items"
  ON public.library_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'teacher'::app_role)
    )
  );

CREATE POLICY "Admins or uploader update library items"
  ON public.library_items FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR uploaded_by = auth.uid()
  );

CREATE POLICY "Admins or uploader delete library items"
  ON public.library_items FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR uploaded_by = auth.uid()
  );

CREATE TRIGGER trg_library_items_updated
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
