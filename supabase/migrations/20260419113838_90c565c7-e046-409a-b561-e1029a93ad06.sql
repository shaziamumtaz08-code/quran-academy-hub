-- 1. Lock down export_audit_logs INSERT
DROP POLICY IF EXISTS "anyone can insert" ON public.export_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert" ON public.export_audit_logs;
DROP POLICY IF EXISTS "Service role can insert export audit logs" ON public.export_audit_logs;

CREATE POLICY "Authenticated users can insert export audit logs"
ON public.export_audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Make financial receipt buckets private
UPDATE storage.buckets
SET public = false
WHERE id IN ('receipts', 'payment-receipts', 'salary-receipts', 'expense-receipts');

-- Drop any prior public read policies on these buckets
DROP POLICY IF EXISTS "Anyone can view payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public read receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;

-- Restrict SELECT on financial receipt buckets to admins / super admins
CREATE POLICY "Admins read financial receipt buckets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('receipts', 'payment-receipts', 'salary-receipts', 'expense-receipts')
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);