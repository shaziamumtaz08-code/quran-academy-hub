CREATE OR REPLACE FUNCTION public.user_created_chat_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_groups cg
    WHERE cg.id = _group_id
      AND cg.created_by = _user_id
  );
$$;

DROP POLICY IF EXISTS "Admins and group creators see chat members" ON public.chat_members;
CREATE POLICY "Admins and group creators see chat members"
ON public.chat_members
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR public.user_created_chat_group(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Group creator or admin can manage members" ON public.chat_members;
CREATE POLICY "Group creator or admin can manage members"
ON public.chat_members
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR public.user_created_chat_group(group_id, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR public.user_created_chat_group(group_id, auth.uid())
);