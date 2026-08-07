CREATE TABLE IF NOT EXISTS public.course_message_sequence_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.course_message_sequences(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  recipient_profile_id uuid,
  recipient_phone text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, recipient_profile_id)
);

GRANT SELECT ON public.course_message_sequence_sends TO authenticated;
GRANT ALL ON public.course_message_sequence_sends TO service_role;

ALTER TABLE public.course_message_sequence_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sequence sends"
ON public.course_message_sequence_sends
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_seq_sends_updated_at
BEFORE UPDATE ON public.course_message_sequence_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.promotional_posts ADD COLUMN IF NOT EXISTS sent_at timestamptz;