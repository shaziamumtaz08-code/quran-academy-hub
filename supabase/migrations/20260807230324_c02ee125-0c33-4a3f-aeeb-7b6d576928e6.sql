
CREATE POLICY "announcements_media_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'announcements');

CREATE POLICY "announcements_media_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "announcements_media_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "announcements_media_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'announcements' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
