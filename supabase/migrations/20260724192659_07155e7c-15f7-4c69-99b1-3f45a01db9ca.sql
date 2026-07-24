CREATE OR REPLACE FUNCTION public.user_in_chat_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.group_id = _group_id
      AND cm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_in_chat_group(_group_id, _user_id);
$$;

DROP POLICY IF EXISTS "student_can_select_chat_groups" ON public.chat_groups;
CREATE POLICY "student_can_select_chat_groups"
ON public.chat_groups
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::public.app_role)
  AND public.user_in_chat_group(id, auth.uid())
);

DROP POLICY IF EXISTS "student_can_select_chat_messages" ON public.chat_messages;
CREATE POLICY "student_can_select_chat_messages"
ON public.chat_messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::public.app_role)
  AND public.user_in_chat_group(group_id, auth.uid())
);

DROP POLICY IF EXISTS "members_can_send_messages" ON public.chat_messages;
CREATE POLICY "members_can_send_messages"
ON public.chat_messages
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.user_in_chat_group(group_id, auth.uid())
);

DROP POLICY IF EXISTS "student_can_select_live_sessions" ON public.live_sessions;
CREATE POLICY "student_can_select_live_sessions"
ON public.live_sessions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::public.app_role)
  AND (
    student_id = auth.uid()
    OR assignment_id IN (
      SELECT public.get_student_active_assignment_ids(auth.uid())
    )
    OR public.user_in_chat_group(group_id, auth.uid())
  )
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
  OR EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_members.group_id
      AND g.created_by = auth.uid()
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_members.group_id
      AND g.created_by = auth.uid()
  )
);