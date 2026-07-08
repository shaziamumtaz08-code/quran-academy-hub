
-- 1. Chat attachments INSERT: enforce folder = chat group user is a member of (or admin)
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Chat attachments: members only upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.group_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 2. Voice notes INSERT: enforce folder = uploader's user_id (or admin)
DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
CREATE POLICY "Voice notes: owner only upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- 3. Payment receipts INSERT: admins only
DROP POLICY IF EXISTS "Authenticated users can upload payment receipts" ON storage.objects;
CREATE POLICY "Payment receipts: admin only upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

-- 4. Salary receipts INSERT: admins only
DROP POLICY IF EXISTS "Authenticated users can upload salary receipts" ON storage.objects;
CREATE POLICY "Salary receipts: admin only upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'salary-receipts'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

-- 5. Expense receipts INSERT: admins only
DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
CREATE POLICY "Expense receipts: admin only upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

-- 6. Payment receipts UPDATE: admins only (previously any authenticated user)
DROP POLICY IF EXISTS "Authenticated users can update payment receipts" ON storage.objects;
CREATE POLICY "Payment receipts: admin only update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);
