CREATE POLICY "Users manage own quiz source uploads"
  ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (bucket_id = 'quiz-sources' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())))
  WITH CHECK (bucket_id = 'quiz-sources' AND auth.uid()::text = (storage.foldername(name))[1]);