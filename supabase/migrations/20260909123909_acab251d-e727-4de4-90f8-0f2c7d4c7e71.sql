ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $$ BEGIN
  ALTER TABLE public.library_items
    ADD CONSTRAINT library_items_approval_status_chk
    CHECK (approval_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_library_items_approval ON public.library_items (approval_status);

-- Non-admin submissions to the shared library always land as pending.
CREATE OR REPLACE FUNCTION public.fn_library_item_approval_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean := is_admin(auth.uid()) OR is_super_admin(auth.uid());
BEGIN
  IF NEW.is_personal THEN
    NEW.approval_status := 'approved';
    RETURN NEW;
  END IF;

  IF v_admin THEN
    IF TG_OP = 'INSERT' AND NEW.approval_status IS NULL THEN
      NEW.approval_status := 'approved';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admins cannot approve their own or anyone else's submissions.
  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
  ELSE
    NEW.approval_status := OLD.approval_status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.review_note := OLD.review_note;
    -- Editing an approved shared item sends it back for review.
    IF OLD.approval_status = 'approved' AND (
         NEW.file_path IS DISTINCT FROM OLD.file_path
      OR NEW.url IS DISTINCT FROM OLD.url
      OR NEW.title IS DISTINCT FROM OLD.title
    ) THEN
      NEW.approval_status := 'pending';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_item_approval_guard ON public.library_items;
CREATE TRIGGER trg_library_item_approval_guard
BEFORE INSERT OR UPDATE ON public.library_items
FOR EACH ROW EXECUTE FUNCTION public.fn_library_item_approval_guard();

-- Anyone signed in may submit to the shared library (trigger marks it pending).
DROP POLICY IF EXISTS "Admins or uploader insert library items" ON public.library_items;
DROP POLICY IF EXISTS "Anyone can upload personal library items" ON public.library_items;
CREATE POLICY "Signed-in users can submit library items"
ON public.library_items FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Only approved shared items are visible to others.
DROP POLICY IF EXISTS "View library items by visibility" ON public.library_items;
CREATE POLICY "View library items by visibility"
ON public.library_items FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR uploaded_by = auth.uid()
  OR (
    NOT is_personal
    AND approval_status = 'approved'
    AND (
      visibility = 'all'
      OR (visibility = 'teachers' AND has_role(auth.uid(), 'teacher'::app_role))
      OR (visibility = 'students' AND has_role(auth.uid(), 'student'::app_role))
      OR (visible_to_roles IS NOT NULL AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (library_items.visible_to_roles)))
    )
  )
);

DROP POLICY IF EXISTS "public read by matching unexpired share token" ON public.library_items;
CREATE POLICY "public read by matching unexpired share token"
ON public.library_items FOR SELECT TO public
USING (
  NOT is_personal
  AND approval_status = 'approved'
  AND share_token IS NOT NULL
  AND length(share_token) >= 32
  AND share_token_expires_at IS NOT NULL
  AND share_token_expires_at > now()
  AND share_token = ((current_setting('request.headers', true))::json ->> 'x-share-token')
);

-- Storage: uploads must live under the uploader's own folder (admins unrestricted).
DROP POLICY IF EXISTS "Authenticated users can upload library files" ON storage.objects;
CREATE POLICY "Library uploads scoped to uploader"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resources'
  AND (
    is_admin(auth.uid()) OR is_super_admin(auth.uid())
    OR name LIKE 'library/' || auth.uid()::text || '/%'
    OR name LIKE 'library-covers/' || auth.uid()::text || '/%'
  )
  AND (name LIKE 'library/%' OR name LIKE 'library-covers/%')
);