-- Add "acted-by-parent" provenance columns (nullable, extend-only).
-- When a parent acts inside a child's portal, sender_id/creator_id/author_id remain
-- the actual logged-in user (the parent), and acted_for_student_id records which child
-- the action was about.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS acted_for_student_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS actor_role text;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS acted_for_student_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS actor_role text;

ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS acted_for_student_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS actor_role text;

CREATE INDEX IF NOT EXISTS idx_chat_messages_acted_for ON public.chat_messages(acted_for_student_id);
CREATE INDEX IF NOT EXISTS idx_tickets_acted_for ON public.tickets(acted_for_student_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_acted_for ON public.ticket_comments(acted_for_student_id);