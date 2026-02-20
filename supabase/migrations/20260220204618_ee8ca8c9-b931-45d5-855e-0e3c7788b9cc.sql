
-- Drop all existing restrictive SELECT policies on tickets
DROP POLICY IF EXISTS "Users can view own created tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view assigned tickets" ON public.tickets;
DROP POLICY IF EXISTS "Watchers can view watched tickets" ON public.tickets;
DROP POLICY IF EXISTS "Parents can view children tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admin can manage all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Assignees can update their tickets" ON public.tickets;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own created tickets"
  ON public.tickets FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Users can view assigned tickets"
  ON public.tickets FOR SELECT
  USING (assignee_id = auth.uid());

CREATE POLICY "Watchers can view watched tickets"
  ON public.tickets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ticket_watchers tw
    WHERE tw.ticket_id = tickets.id AND tw.user_id = auth.uid()
  ));

CREATE POLICY "Parents can view children tickets"
  ON public.tickets FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND (
      creator_id IN (SELECT get_parent_children_ids(auth.uid()))
      OR assignee_id IN (SELECT get_parent_children_ids(auth.uid()))
    )
  );

CREATE POLICY "Admin can manage all tickets"
  ON public.tickets FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND creator_id = auth.uid());

CREATE POLICY "Assignees can update their tickets"
  ON public.tickets FOR UPDATE
  USING (assignee_id = auth.uid());
