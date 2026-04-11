
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-assets', 'course-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for course-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-assets');

CREATE POLICY "Authenticated users can upload course-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-assets');

CREATE POLICY "Authenticated users can update course-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-assets');

CREATE POLICY "Authenticated users can delete course-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-assets');
