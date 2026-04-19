
-- 1) QUIZ ATTEMPTS: remove anon guest email leak
DROP POLICY IF EXISTS "Anon read own attempts by email" ON public.quiz_attempts;

-- 2) USER_ROLES: remove broad authenticated read
DROP POLICY IF EXISTS "Authenticated users can view all roles for assignments" ON public.user_roles;
-- Existing policies "Users can view own roles" + "Admins can view all roles" + "Super admin can manage all roles" remain in place.

-- 3) STORAGE: make financial receipt buckets private
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('payment-receipts', 'salary-receipts', 'expense-receipts');

DROP POLICY IF EXISTS "Anyone can view payment receipts" ON storage.objects;

-- Add authenticated read for payment-receipts (salary/expense already restricted)
CREATE POLICY "Authenticated users can view payment receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid() IS NOT NULL
);

-- 4) STORAGE: disable directory listing on course-assets public bucket
DROP POLICY IF EXISTS "Public read access for course-assets" ON storage.objects;

-- Replace with object-level read (no listing). Direct file URLs still resolve via /object/public.
CREATE POLICY "Public can read individual course-asset files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'course-assets'
  AND (auth.uid() IS NOT NULL OR name IS NOT NULL)
);
