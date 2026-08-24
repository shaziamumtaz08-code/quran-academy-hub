DROP POLICY IF EXISTS "Authenticated view own organization" ON public.organizations;

CREATE POLICY "Authenticated view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR id IN (
    SELECT uc.organization_id
    FROM public.user_context uc
    WHERE uc.user_id = auth.uid()
      AND uc.organization_id IS NOT NULL
  )
);