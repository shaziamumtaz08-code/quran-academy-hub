
-- Tighten course-assets bucket writes to admins
DROP POLICY IF EXISTS "Authenticated users can upload course-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update course-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete course-assets" ON storage.objects;

CREATE POLICY "Admins can upload course-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-assets' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins can update course-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-assets' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins can delete course-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-assets' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

-- Tighten subject-images bucket writes to admins
DROP POLICY IF EXISTS "Authenticated upload subject images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update subject images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete subject images" ON storage.objects;

CREATE POLICY "Admins upload subject images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'subject-images' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins update subject images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'subject-images' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins delete subject images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'subject-images' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

-- library_items: replace over-broad public share_token policy with token-matching one
DROP POLICY IF EXISTS "public read by share token" ON public.library_items;

CREATE POLICY "public read by matching share token"
ON public.library_items FOR SELECT
TO anon
USING (
  share_token IS NOT NULL
  AND share_token::text = current_setting('request.headers', true)::json->>'x-share-token'
);
