
-- Schema additions to live_sessions
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid text,
  ADD COLUMN IF NOT EXISTS stored_file_size_mb numeric,
  ADD COLUMN IF NOT EXISTS zoom_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS download_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_last_error text;

CREATE INDEX IF NOT EXISTS idx_live_sessions_zoom_meeting_uuid
  ON public.live_sessions(zoom_meeting_uuid)
  WHERE zoom_meeting_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_recording_status
  ON public.live_sessions(recording_status);

-- Storage policies for session-recordings bucket
-- Admins read all
DROP POLICY IF EXISTS "session_recordings_admin_read" ON storage.objects;
CREATE POLICY "session_recordings_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-recordings'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Teachers read their own session recordings (path starts with their teacher_id)
DROP POLICY IF EXISTS "session_recordings_teacher_read" ON storage.objects;
CREATE POLICY "session_recordings_teacher_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Students read recordings for sessions where they are the assigned student
DROP POLICY IF EXISTS "session_recordings_student_read" ON storage.objects;
CREATE POLICY "session_recordings_student_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-recordings'
    AND EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id::text = (storage.foldername(name))[2]
        AND ls.student_id = auth.uid()
    )
  );
