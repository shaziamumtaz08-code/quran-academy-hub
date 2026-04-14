-- Drop old restrictive delete policy
DROP POLICY IF EXISTS "Users can delete own syllabi" ON public.syllabi;

-- Create new policy: owner OR admin/super_admin can delete
CREATE POLICY "Users can delete own syllabi or admins"
ON public.syllabi
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);