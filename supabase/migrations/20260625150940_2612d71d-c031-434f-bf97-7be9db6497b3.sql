
REVOKE SELECT (webhook_secret) ON public.courses FROM anon, authenticated;

REVOKE SELECT (pin_hash, pin_salt) ON public.minor_credentials FROM anon, authenticated;

DROP POLICY IF EXISTS "Public can read individual course-asset files" ON storage.objects;
DROP POLICY IF EXISTS "Subject images authenticated list" ON storage.objects;

DROP POLICY IF EXISTS "Anyone authenticated can view course materials" ON storage.objects;
CREATE POLICY "Course materials: enrolled or staff read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials' AND (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_lessons cl
      WHERE cl.file_url LIKE '%' || objects.name
        AND public.can_view_course_content(cl.course_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.file_url LIKE '%' || objects.name
        AND public.can_view_course_content(ca.course_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.course_library_assets cla
      WHERE cla.content_url LIKE '%' || objects.name
        AND public.can_view_course_content(cla.course_id)
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can view resource files" ON storage.objects;
CREATE POLICY "Resource files: visibility enforced"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resources' AND (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.url LIKE '%' || objects.name
        AND r.deleted_at IS NULL
        AND public.can_view_resource_visibility(r.visibility, r.visible_to_roles)
    )
  )
);

DROP POLICY IF EXISTS "Chat members subscribe to chat group topics" ON realtime.messages;
CREATE POLICY "Chat members subscribe to chat group topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.user_id = auth.uid()
      AND realtime.messages.topic LIKE '%' || cm.group_id::text || '%'
  )
);
