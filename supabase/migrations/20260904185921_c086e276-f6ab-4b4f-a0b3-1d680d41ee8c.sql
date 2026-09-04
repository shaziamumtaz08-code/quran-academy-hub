-- 1) Personal flag on library_items
ALTER TABLE public.library_items ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

-- 2) Gate the existing broad read policy so personal items never leak,
--    while letting owners (and admins) always read their own items.
DROP POLICY IF EXISTS "View library items by visibility" ON public.library_items;
CREATE POLICY "View library items by visibility"
ON public.library_items FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR (uploaded_by = auth.uid())
  OR (
    NOT is_personal AND (
      (visibility = 'all')
      OR (visibility = 'teachers' AND has_role(auth.uid(), 'teacher'::app_role))
      OR (visibility = 'students' AND has_role(auth.uid(), 'student'::app_role))
      OR (visible_to_roles IS NOT NULL AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (library_items.visible_to_roles)
      ))
    )
  )
);

-- Share-token public read must never expose personal files.
DROP POLICY IF EXISTS "public read by matching unexpired share token" ON public.library_items;
CREATE POLICY "public read by matching unexpired share token"
ON public.library_items FOR SELECT
USING (
  NOT is_personal
  AND share_token IS NOT NULL AND length(share_token) >= 32
  AND share_token_expires_at IS NOT NULL AND share_token_expires_at > now()
  AND share_token = ((current_setting('request.headers', true))::json ->> 'x-share-token')
);

-- 3) Any signed-in user may upload, but non-staff uploads must be personal.
CREATE POLICY "Anyone can upload personal library items"
ON public.library_items FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    is_personal = true
    OR is_admin(auth.uid())
    OR is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- 4) Shares recorded when a personal file is shown in class.
CREATE TABLE public.personal_item_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  shared_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.personal_item_shares TO authenticated;
GRANT ALL ON public.personal_item_shares TO service_role;
ALTER TABLE public.personal_item_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can share personal items"
ON public.personal_item_shares FOR INSERT TO authenticated
WITH CHECK (
  shared_by = auth.uid()
  AND (
    is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = item_id AND (li.uploaded_by = auth.uid() OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Recipients and staff can view shares"
ON public.personal_item_shares FOR SELECT TO authenticated
USING (
  shared_by = auth.uid()
  OR student_id = auth.uid()
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.student_parent_links spl
    WHERE spl.parent_id = auth.uid() AND spl.student_id = personal_item_shares.student_id
  )
);

CREATE POLICY "Sharer or admins can revoke shares"
ON public.personal_item_shares FOR DELETE TO authenticated
USING (shared_by = auth.uid() OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 5) Read access to a personal file extends to students it was shared with (and their parents).
CREATE POLICY "Shared personal items readable by recipients"
ON public.library_items FOR SELECT TO authenticated
USING (
  is_personal AND EXISTS (
    SELECT 1 FROM public.personal_item_shares ps
    WHERE ps.item_id = library_items.id
      AND (
        ps.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.student_parent_links spl
          WHERE spl.parent_id = auth.uid() AND spl.student_id = ps.student_id
        )
      )
  )
);