ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS is_syllabus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS syllabus_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS syllabus_folder text,
  ADD COLUMN IF NOT EXISTS syllabus_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_library_items_syllabus
  ON public.library_items (is_syllabus, syllabus_subject_id, syllabus_order);

CREATE TABLE IF NOT EXISTS public.vcr_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  content_type text NOT NULL CHECK (content_type IN ('mushaf','qaida','pdf','image')),
  library_item_id uuid REFERENCES public.library_items(id) ON DELETE CASCADE,
  unit integer NOT NULL DEFAULT 1,
  label text,
  color text,
  reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','class')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcr_bookmarks_lookup
  ON public.vcr_bookmarks (student_id, content_type, library_item_id, unit);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vcr_bookmarks TO authenticated;
GRANT ALL ON public.vcr_bookmarks TO service_role;

ALTER TABLE public.vcr_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookmarks readable by owner, student, guardians, teachers, admins"
ON public.vcr_bookmarks FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR (
    scope = 'class' AND (
      student_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_role(auth.uid(), 'teacher')
      OR EXISTS (
        SELECT 1 FROM public.student_parent_links spl
        WHERE spl.parent_id = auth.uid() AND spl.student_id = vcr_bookmarks.student_id
      )
    )
  )
);

CREATE POLICY "Users create their own bookmarks"
ON public.vcr_bookmarks FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins edit bookmarks"
ON public.vcr_bookmarks FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners and admins delete bookmarks"
ON public.vcr_bookmarks FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER vcr_bookmarks_updated_at
BEFORE UPDATE ON public.vcr_bookmarks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();