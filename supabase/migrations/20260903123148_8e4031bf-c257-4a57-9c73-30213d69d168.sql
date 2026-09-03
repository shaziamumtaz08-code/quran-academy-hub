CREATE TABLE IF NOT EXISTS public.vcr_call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  student_id uuid,
  teacher_id uuid,
  storage_path text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  consent_teacher boolean NOT NULL DEFAULT false,
  consent_student boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  status text NOT NULL DEFAULT 'recording',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vcr_call_recordings TO authenticated;
GRANT ALL ON public.vcr_call_recordings TO service_role;

ALTER TABLE public.vcr_call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordings_read_participants" ON public.vcr_call_recordings AS PERMISSIVE FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid()
  OR student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "recordings_insert_teacher" ON public.vcr_call_recordings AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND teacher_id = auth.uid());

CREATE POLICY "recordings_update_teacher" ON public.vcr_call_recordings AS PERMISSIVE FOR UPDATE TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_vcr_call_recordings_room ON public.vcr_call_recordings (room_id, started_at DESC);

CREATE POLICY "vcr_rec_upload_staff" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vcr-call-recordings');

CREATE POLICY "vcr_rec_read_participants" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vcr-call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.vcr_call_recordings r
    WHERE r.storage_path = storage.objects.name
      AND (r.teacher_id = auth.uid() OR r.student_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
);