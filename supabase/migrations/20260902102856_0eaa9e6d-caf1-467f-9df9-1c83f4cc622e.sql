-- 1) Per-account switch for the in-app Zoom Meeting SDK embed.
ALTER TABLE public.zoom_accounts
  ADD COLUMN IF NOT EXISTS sdk_embed_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.zoom_accounts.sdk_embed_enabled IS
  'When false, this Zoom account never uses the in-app Meeting SDK embed; joins fall back to the plain Zoom link.';

-- 2) Zoom S2S webhook telemetry rolled up into a per-session attendance report.
CREATE OR REPLACE VIEW public.zoom_session_attendance_report
WITH (security_invoker = on) AS
WITH participant AS (
  SELECT
    l.session_id,
    COALESCE(NULLIF(lower(trim(l.participant_email)), ''), lower(trim(l.participant_name))) AS participant_key,
    max(l.participant_name)  AS participant_name,
    max(NULLIF(trim(l.participant_email), '')) AS participant_email,
    max(l.role) FILTER (WHERE l.role IS NOT NULL AND l.role <> 'unknown') AS zoom_role,
    min(l.join_time)  AS join_time,
    max(l.leave_time) AS leave_time,
    max(l.total_duration_minutes) AS duration_minutes,
    max(l.zoom_meeting_id) AS zoom_meeting_id,
    max(l.zoom_account_id::text)::uuid AS zoom_account_id
  FROM public.zoom_attendance_logs l
  WHERE l.session_id IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  s.id                                   AS session_id,
  s.teacher_id,
  s.student_id,
  s.assignment_id,
  s.scheduled_start,
  s.actual_start,
  s.actual_end,
  s.status                               AS session_status,
  COALESCE(p.zoom_account_id, s.zoom_account_id) AS zoom_account_id,
  COALESCE(sch.duration_minutes, 30)     AS scheduled_minutes,
  s.scheduled_start + (COALESCE(sch.duration_minutes, 30) || ' minutes')::interval AS scheduled_end,
  p.participant_key,
  p.participant_name,
  p.participant_email,
  COALESCE(p.zoom_role, 'unknown')       AS zoom_role,
  p.join_time,
  p.leave_time,
  p.duration_minutes,
  p.zoom_meeting_id,
  CASE
    WHEN p.join_time IS NULL THEN NULL
    ELSE round(EXTRACT(EPOCH FROM (p.join_time - s.scheduled_start)) / 60.0)::int
  END                                    AS late_minutes,
  CASE
    WHEN p.leave_time IS NULL OR s.scheduled_start IS NULL THEN NULL
    ELSE round(
      EXTRACT(EPOCH FROM (
        (s.scheduled_start + (COALESCE(sch.duration_minutes, 30) || ' minutes')::interval) - p.leave_time
      )) / 60.0
    )::int
  END                                    AS early_leave_minutes,
  CASE
    WHEN p.join_time IS NULL THEN 'no_show'
    WHEN p.join_time > s.scheduled_start + interval '5 minutes' THEN 'late'
    WHEN p.leave_time IS NOT NULL
      AND p.leave_time < s.scheduled_start + (COALESCE(sch.duration_minutes, 30) || ' minutes')::interval - interval '5 minutes'
      THEN 'left_early'
    ELSE 'on_time'
  END                                    AS punctuality
FROM public.live_sessions s
LEFT JOIN participant p ON p.session_id = s.id
LEFT JOIN public.schedules sch ON sch.id = s.schedule_id;

GRANT SELECT ON public.zoom_session_attendance_report TO authenticated;
GRANT SELECT ON public.zoom_session_attendance_report TO service_role;