
CREATE POLICY "Authenticated upload reports-exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports-exports');

CREATE POLICY "Authenticated read reports-exports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports-exports');
