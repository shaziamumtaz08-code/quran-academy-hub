-- Fix ticket_comments RLS: creators can now see replies on their own tickets
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Admin can manage all comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can comment on their tickets" ON public.ticket_comments;

CREATE POLICY "Users can view comments on their tickets"
  ON public.ticket_comments FOR SELECT
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.creator_id = auth.uid()
          OR t.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM ticket_watchers tw
            WHERE tw.ticket_id = t.id AND tw.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Admin can manage all comments"
  ON public.ticket_comments FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can comment on their tickets"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.creator_id = auth.uid()
          OR t.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM ticket_watchers tw
            WHERE tw.ticket_id = t.id AND tw.user_id = auth.uid()
          )
        )
    )
  );