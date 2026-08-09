CREATE POLICY "tutorial_videos_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tutorial-videos');

CREATE POLICY "tutorial_videos_admin_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutorial-videos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "tutorial_videos_admin_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tutorial-videos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "tutorial_videos_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tutorial-videos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));