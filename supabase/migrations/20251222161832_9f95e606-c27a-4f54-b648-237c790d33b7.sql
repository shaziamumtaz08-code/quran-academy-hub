-- Make the resources bucket private
UPDATE storage.buckets SET public = false WHERE id = 'resources';

-- Drop the existing public SELECT policy
DROP POLICY IF EXISTS "Anyone can view resource files" ON storage.objects;

-- Create new policy requiring authentication for viewing files
CREATE POLICY "Authenticated users can view resource files"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources' AND auth.uid() IS NOT NULL);