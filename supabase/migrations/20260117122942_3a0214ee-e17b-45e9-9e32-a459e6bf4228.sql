-- Update the admin policy to include super_admin for exam_templates
DROP POLICY IF EXISTS "Admin can manage templates" ON public.exam_templates;

CREATE POLICY "Admin can manage templates"
ON public.exam_templates
FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));