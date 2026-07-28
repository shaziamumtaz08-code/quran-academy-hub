CREATE POLICY "Admins can view all push tokens"
ON public.push_tokens
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));