ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('subject-images', 'subject-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Subject images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'subject-images');

CREATE POLICY "Authenticated upload subject images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'subject-images');

CREATE POLICY "Authenticated update subject images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'subject-images');

CREATE POLICY "Authenticated delete subject images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'subject-images');