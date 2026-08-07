DROP POLICY IF EXISTS "Authorized users can view worksheets" ON public.worksheets;
CREATE POLICY "Managers view worksheets" ON public.worksheets
FOR SELECT TO authenticated
USING (public.can_manage_content_kit(kit_id));