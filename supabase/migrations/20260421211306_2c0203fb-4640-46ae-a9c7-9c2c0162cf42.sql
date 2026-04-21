DROP POLICY IF EXISTS "Admin can manage parent links" ON public.student_parent_links;

CREATE POLICY "Admins can manage parent links"
ON public.student_parent_links
FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));