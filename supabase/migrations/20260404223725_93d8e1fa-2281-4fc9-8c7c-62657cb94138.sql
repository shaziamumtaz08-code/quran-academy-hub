
-- Task comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task participants can view comments"
ON public.task_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Authenticated users can add comments"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- Add source tracking to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_id UUID;

-- Add forwarding support to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS forwarded_from TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS forwarded_source_group TEXT;

-- Add DM flag to chat_groups
ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS is_dm BOOLEAN NOT NULL DEFAULT false;

-- Index for task comments
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
