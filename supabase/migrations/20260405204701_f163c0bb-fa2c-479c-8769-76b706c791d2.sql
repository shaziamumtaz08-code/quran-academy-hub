
-- Add voice_note_url column to attendance
ALTER TABLE public.attendance ADD COLUMN voice_note_url text;

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-notes', 'voice-notes', true);

-- Storage policies for voice notes
CREATE POLICY "Anyone can view voice notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-notes');

CREATE POLICY "Authenticated users can upload voice notes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own voice notes"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
