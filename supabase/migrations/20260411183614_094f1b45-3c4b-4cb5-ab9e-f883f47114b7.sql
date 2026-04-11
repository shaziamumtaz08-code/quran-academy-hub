
INSERT INTO storage.buckets (id, name, public) VALUES ('registration-uploads', 'registration-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload registration files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'registration-uploads');

CREATE POLICY "Registration uploads are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'registration-uploads');
