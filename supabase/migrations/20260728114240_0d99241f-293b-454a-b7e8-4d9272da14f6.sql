CREATE TABLE public.class_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.schedules(id) NOT NULL,
  occurrence_date date NOT NULL,
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('teacher','student')),
  recipient_id uuid REFERENCES auth.users(id) NOT NULL,
  realtime_sent boolean DEFAULT false,
  push_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_class_pings_schedule_occurrence ON public.class_pings(schedule_id, occurrence_date);
CREATE INDEX idx_class_pings_cooldown ON public.class_pings(schedule_id, occurrence_date, sender_id, created_at DESC);

GRANT SELECT ON public.class_pings TO authenticated;
GRANT ALL ON public.class_pings TO service_role;

ALTER TABLE public.class_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their pings"
ON public.class_pings AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Admins can view all pings"
ON public.class_pings AS PERMISSIVE FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));