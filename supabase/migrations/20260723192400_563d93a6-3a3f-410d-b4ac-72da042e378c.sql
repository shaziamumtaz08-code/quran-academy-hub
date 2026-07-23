
-- 1) Rewrite chat_members SELECT policy to be structurally non-recursive.
--    Split into narrow, direct policies. The one path that needs to look
--    at co-members uses a SECURITY DEFINER helper that bypasses RLS, so
--    it does NOT re-enter the chat_members policy chain.

DROP POLICY IF EXISTS "Members can view membership" ON public.chat_members;

CREATE POLICY "Users see own chat membership"
  ON public.chat_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and group creators see chat members"
  ON public.chat_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_groups g
      WHERE g.id = chat_members.group_id
        AND g.created_by = auth.uid()
    )
  );

-- Non-recursive helper: SECURITY DEFINER so it bypasses RLS on chat_members
-- when invoked from a policy. Kept separate from is_chat_member for clarity.
CREATE OR REPLACE FUNCTION public.user_in_chat_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_in_chat_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_in_chat_group(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Co-members see each other"
  ON public.chat_members
  FOR SELECT
  TO authenticated
  USING (public.user_in_chat_group(group_id, auth.uid()));

-- 2) Rewrite chat-attachments storage policies to call the SECURITY DEFINER
--    helper instead of doing an EXISTS subquery on public.chat_members
--    (which would re-enter the chat_members RLS chain).

DROP POLICY IF EXISTS "Chat attachments: members only read" ON storage.objects;
DROP POLICY IF EXISTS "Chat attachments: members only upload" ON storage.objects;

CREATE POLICY "Chat attachments: members only read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.user_in_chat_group(
           NULLIF((storage.foldername(name))[1], '')::uuid,
           auth.uid()
         )
    )
  );

CREATE POLICY "Chat attachments: members only upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.user_in_chat_group(
           NULLIF((storage.foldername(name))[1], '')::uuid,
           auth.uid()
         )
    )
  );
