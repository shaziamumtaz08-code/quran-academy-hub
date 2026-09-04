
-- 1. My Resources shelf
CREATE TABLE public.user_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_item_id uuid REFERENCES public.library_items(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'reference' CHECK (kind IN ('reference','copy')),
  title text NOT NULL,
  description text,
  type text,
  cover_image text,
  file_path text,
  current_version integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_resources_unique_reference
  ON public.user_resources (user_id, source_item_id)
  WHERE kind = 'reference' AND source_item_id IS NOT NULL;
CREATE INDEX user_resources_user_idx ON public.user_resources (user_id, created_at DESC);
CREATE INDEX user_resources_source_idx ON public.user_resources (source_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resources TO authenticated;
GRANT ALL ON public.user_resources TO service_role;
ALTER TABLE public.user_resources ENABLE ROW LEVEL SECURITY;

-- 2. Versions of a personal working copy
CREATE TABLE public.user_resource_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.user_resources(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  file_path text,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, version_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resource_versions TO authenticated;
GRANT ALL ON public.user_resource_versions TO service_role;
ALTER TABLE public.user_resource_versions ENABLE ROW LEVEL SECURITY;

-- 3. Annotations on a personal copy (per page)
CREATE TABLE public.user_resource_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.user_resources(id) ON DELETE CASCADE,
  page integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, page)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resource_annotations TO authenticated;
GRANT ALL ON public.user_resource_annotations TO service_role;
ALTER TABLE public.user_resource_annotations ENABLE ROW LEVEL SECURITY;

-- 4. Sharing a personal resource with another person
CREATE TABLE public.user_resource_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.user_resources(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL,
  shared_by uuid NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, shared_with)
);
CREATE INDEX user_resource_shares_with_idx ON public.user_resource_shares (shared_with);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resource_shares TO authenticated;
GRANT ALL ON public.user_resource_shares TO service_role;
ALTER TABLE public.user_resource_shares ENABLE ROW LEVEL SECURITY;

-- Helper: can the current user read / write a given personal resource
CREATE OR REPLACE FUNCTION public.can_read_user_resource(_resource_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_resources r
    WHERE r.id = _resource_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_resource_shares s
          WHERE s.resource_id = r.id AND s.shared_with = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'super_admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_user_resource(_resource_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_resources r
    WHERE r.id = _resource_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_resource_shares s
          WHERE s.resource_id = r.id AND s.shared_with = auth.uid() AND s.can_edit
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_user_resource(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_write_user_resource(uuid) FROM anon;

-- Policies: user_resources
CREATE POLICY "Owners manage their resources" ON public.user_resources
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Recipients can view shared resources" ON public.user_resources
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_resource_shares s
    WHERE s.resource_id = user_resources.id AND s.shared_with = auth.uid()
  ));
CREATE POLICY "Editors can update shared resources" ON public.user_resources
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_resource_shares s
    WHERE s.resource_id = user_resources.id AND s.shared_with = auth.uid() AND s.can_edit
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_resource_shares s
    WHERE s.resource_id = user_resources.id AND s.shared_with = auth.uid() AND s.can_edit
  ));
CREATE POLICY "Admins can view all resources" ON public.user_resources
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Policies: versions
CREATE POLICY "Read versions of readable resources" ON public.user_resource_versions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_read_user_resource(resource_id));
CREATE POLICY "Write versions of writable resources" ON public.user_resource_versions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_write_user_resource(resource_id) AND created_by = auth.uid());
CREATE POLICY "Update versions of writable resources" ON public.user_resource_versions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_write_user_resource(resource_id))
  WITH CHECK (public.can_write_user_resource(resource_id));
CREATE POLICY "Delete versions of writable resources" ON public.user_resource_versions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_write_user_resource(resource_id));

-- Policies: annotations
CREATE POLICY "Read annotations of readable resources" ON public.user_resource_annotations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_read_user_resource(resource_id));
CREATE POLICY "Insert annotations on writable resources" ON public.user_resource_annotations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_write_user_resource(resource_id));
CREATE POLICY "Update annotations on writable resources" ON public.user_resource_annotations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_write_user_resource(resource_id))
  WITH CHECK (public.can_write_user_resource(resource_id));
CREATE POLICY "Delete annotations on writable resources" ON public.user_resource_annotations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_write_user_resource(resource_id));

-- Policies: shares
CREATE POLICY "Owners manage shares" ON public.user_resource_shares
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_resources r WHERE r.id = resource_id AND r.user_id = auth.uid()))
  WITH CHECK (shared_by = auth.uid() AND EXISTS (SELECT 1 FROM public.user_resources r WHERE r.id = resource_id AND r.user_id = auth.uid()));
CREATE POLICY "Recipients can view their shares" ON public.user_resource_shares
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (shared_with = auth.uid());
CREATE POLICY "Admins can view shares" ON public.user_resource_shares
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- updated_at triggers
CREATE TRIGGER update_user_resources_updated_at
  BEFORE UPDATE ON public.user_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_resource_annotations_updated_at
  BEFORE UPDATE ON public.user_resource_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
