-- 1) Fix course-materials teacher upload policy
DROP POLICY IF EXISTS "Teachers can upload course materials" ON storage.objects;

CREATE POLICY "Teachers can upload course materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (
    -- own personal folder
    (storage.foldername(name))[1] = (auth.uid())::text
    -- scoped area under a known prefix, owned by the teacher
    OR (
      (storage.foldername(name))[1] = ANY (ARRAY['assignments','announcements','submissions'])
      AND (storage.foldername(name))[2] = (auth.uid())::text
    )
    -- shared teaching content workspace
    OR (storage.foldername(name))[1] = 'content-kit'
    -- course folder where the teacher is assigned staff
    OR EXISTS (
      SELECT 1
      FROM course_class_staff ccs
      JOIN course_classes cc ON cc.id = ccs.class_id
      WHERE (cc.course_id)::text = (storage.foldername(name))[1]
        AND ccs.user_id = auth.uid()
    )
  )
);

-- 2) Restrict organizations.settings to admins only
REVOKE SELECT ON public.organizations FROM authenticated;
GRANT SELECT (id, name, slug, logo_url, code, created_at, updated_at) ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
