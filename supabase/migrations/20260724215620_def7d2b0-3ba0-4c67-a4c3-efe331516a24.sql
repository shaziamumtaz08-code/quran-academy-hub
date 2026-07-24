
CREATE TABLE IF NOT EXISTS public.zoom_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_ts timestamptz,
  zoom_meeting_uuid text,
  zoom_meeting_id text,
  zoom_host_id text,
  participant_name text,
  participant_email text,
  raw_payload jsonb NOT NULL,
  processed_session_id uuid,
  processing_note text,
  received_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zoom_webhook_events TO authenticated;
GRANT ALL ON public.zoom_webhook_events TO service_role;
ALTER TABLE public.zoom_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view zoom webhook events"
ON public.zoom_webhook_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_meeting_uuid
  ON public.zoom_webhook_events (zoom_meeting_uuid, received_at DESC)
  WHERE zoom_meeting_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_received_at
  ON public.zoom_webhook_events (received_at DESC);

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS session_source text NOT NULL DEFAULT 'app';
COMMENT ON COLUMN public.live_sessions.session_source IS
  'app = created via LMS scheduling; zoom_monitor = auto-created by Zoom webhook.';

-- Purge existing duplicate leave rows (keep the row with join_time populated, fall back to earliest id)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY session_id,
                        lower(COALESCE(NULLIF(participant_email, ''), participant_name)),
                        leave_time
           ORDER BY (join_time IS NOT NULL) DESC,
                    (total_duration_minutes IS NOT NULL) DESC,
                    timestamp ASC,
                    id ASC
         ) AS rn
  FROM public.zoom_attendance_logs
  WHERE action = 'leave'
    AND session_id IS NOT NULL
    AND leave_time IS NOT NULL
)
DELETE FROM public.zoom_attendance_logs z
USING ranked r
WHERE z.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY zoom_license_id, zoom_meeting_uuid,
                        lower(COALESCE(NULLIF(participant_email, ''), participant_name)),
                        leave_time
           ORDER BY (join_time IS NOT NULL) DESC,
                    (total_duration_minutes IS NOT NULL) DESC,
                    timestamp ASC,
                    id ASC
         ) AS rn
  FROM public.zoom_attendance_logs
  WHERE action = 'leave'
    AND session_id IS NULL
    AND zoom_license_id IS NOT NULL
    AND zoom_meeting_uuid IS NOT NULL
    AND leave_time IS NOT NULL
)
DELETE FROM public.zoom_attendance_logs z
USING ranked r
WHERE z.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_zoom_leave_by_session_participant
  ON public.zoom_attendance_logs (
    session_id,
    lower(COALESCE(NULLIF(participant_email, ''), participant_name)),
    leave_time
  )
  WHERE action = 'leave' AND session_id IS NOT NULL AND leave_time IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_zoom_leave_by_room_participant
  ON public.zoom_attendance_logs (
    zoom_license_id, zoom_meeting_uuid,
    lower(COALESCE(NULLIF(participant_email, ''), participant_name)),
    leave_time
  )
  WHERE action = 'leave' AND session_id IS NULL
    AND zoom_license_id IS NOT NULL AND zoom_meeting_uuid IS NOT NULL
    AND leave_time IS NOT NULL;
