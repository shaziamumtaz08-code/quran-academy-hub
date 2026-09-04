CREATE OR REPLACE FUNCTION public.user_resource_owner(_resource_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_resources WHERE id = _resource_id
$$;

CREATE OR REPLACE FUNCTION public.user_resource_share_level(_resource_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN bool_or(can_edit) THEN 'edit' ELSE 'view' END
  FROM public.user_resource_shares
  WHERE resource_id = _resource_id AND shared_with = _user_id
  HAVING count(*) > 0
$$;

REVOKE EXECUTE ON FUNCTION public.user_resource_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_resource_share_level(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_resource_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_resource_share_level(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Recipients can view shared resources" ON public.user_resources;
CREATE POLICY "Recipients can view shared resources" ON public.user_resources
FOR SELECT TO authenticated
USING (public.user_resource_share_level(id, auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Editors can update shared resources" ON public.user_resources;
CREATE POLICY "Editors can update shared resources" ON public.user_resources
FOR UPDATE TO authenticated
USING (public.user_resource_share_level(id, auth.uid()) = 'edit')
WITH CHECK (public.user_resource_share_level(id, auth.uid()) = 'edit');

DROP POLICY IF EXISTS "Owners manage shares" ON public.user_resource_shares;
CREATE POLICY "Owners manage shares" ON public.user_resource_shares
FOR ALL TO authenticated
USING (public.user_resource_owner(resource_id) = auth.uid())
WITH CHECK (shared_by = auth.uid() AND public.user_resource_owner(resource_id) = auth.uid());