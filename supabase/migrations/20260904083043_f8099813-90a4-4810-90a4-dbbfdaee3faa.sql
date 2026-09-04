CREATE TABLE IF NOT EXISTS public.vcr_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  student_id uuid,
  initiator_id uuid NOT NULL,
  initiator_role text,
  peer_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'ringing',
  recorded boolean NOT NULL DEFAULT false,
  recording_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcr_call_logs_room ON public.vcr_call_logs(room_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vcr_call_logs_student ON public.vcr_call_logs(student_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.vcr_call_logs TO authenticated;
GRANT ALL ON public.vcr_call_logs TO service_role;

ALTER TABLE public.vcr_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vcr_call_logs_select_participants" ON public.vcr_call_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    initiator_id = auth.uid()
    OR student_id = auth.uid()
    OR peer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "vcr_call_logs_insert_self" ON public.vcr_call_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (initiator_id = auth.uid());

CREATE POLICY "vcr_call_logs_update_participants" ON public.vcr_call_logs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    initiator_id = auth.uid()
    OR peer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (true);
