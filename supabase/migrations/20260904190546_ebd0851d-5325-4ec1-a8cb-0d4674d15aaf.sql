-- Let any signed-in user upload NEW files for their personal library space.
-- (No UPDATE policy exists for this bucket, so existing files cannot be overwritten.)
CREATE POLICY "Authenticated users can upload library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resources'
  AND (name LIKE 'library/%' OR name LIKE 'library-covers/%')
);

-- Read access follows library_items visibility, ownership and class shares.
CREATE POLICY "Library item files readable by access rules"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resources'
  AND EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE (li.file_path = objects.name OR li.cover_image = objects.name)
      AND (
        li.uploaded_by = auth.uid()
        OR is_admin(auth.uid())
        OR is_super_admin(auth.uid())
        OR (
          NOT li.is_personal
          AND can_view_resource_visibility(li.visibility, li.visible_to_roles)
        )
        OR (
          li.is_personal AND EXISTS (
            SELECT 1 FROM public.personal_item_shares ps
            WHERE ps.item_id = li.id
              AND (
                ps.student_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.student_parent_links spl
                  WHERE spl.parent_id = auth.uid() AND spl.student_id = ps.student_id
                )
              )
          )
        )
      )
  )
);