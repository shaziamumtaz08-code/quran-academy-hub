
-- Create dm_requests table
CREATE TABLE IF NOT EXISTS public.dm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, recipient_id, course_id)
);

ALTER TABLE public.dm_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dm requests"
  ON public.dm_requests FOR ALL TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Admins manage all dm requests"
  ON public.dm_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers manage course dm requests"
  ON public.dm_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));

-- Add is_flagged column to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
