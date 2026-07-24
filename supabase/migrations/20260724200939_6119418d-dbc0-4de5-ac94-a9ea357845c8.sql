CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_sessions_active_zoom_meeting_uuid
  ON public.live_sessions (zoom_meeting_uuid)
  WHERE zoom_meeting_uuid IS NOT NULL
    AND status IN ('live'::public.session_status, 'scheduled'::public.session_status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_sessions_active_license
  ON public.live_sessions (license_id)
  WHERE license_id IS NOT NULL
    AND status IN ('live'::public.session_status, 'scheduled'::public.session_status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_zoom_open_join_by_session_participant
  ON public.zoom_attendance_logs (
    session_id,
    lower(coalesce(nullif(participant_email, ''), participant_name))
  )
  WHERE session_id IS NOT NULL
    AND action = 'join_intent'::public.attendance_action
    AND leave_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_zoom_open_join_by_room_participant
  ON public.zoom_attendance_logs (
    zoom_license_id,
    zoom_meeting_uuid,
    lower(coalesce(nullif(participant_email, ''), participant_name))
  )
  WHERE zoom_license_id IS NOT NULL
    AND zoom_meeting_uuid IS NOT NULL
    AND action = 'join_intent'::public.attendance_action
    AND leave_time IS NULL;