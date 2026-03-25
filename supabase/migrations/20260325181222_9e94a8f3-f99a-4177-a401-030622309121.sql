INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Anyone can view receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts');