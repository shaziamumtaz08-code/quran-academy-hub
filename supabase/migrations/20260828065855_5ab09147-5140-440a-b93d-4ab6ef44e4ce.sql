CREATE OR REPLACE FUNCTION public.close_stale_live_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  closed_count integer := 0;
BEGIN
  WITH stale AS (
    SELECT ls.id,
           GREATEST(
             COALESCE((SELECT max(COALESCE(l.leave_time, l.timestamp))
                       FROM zoom_attendance_logs l WHERE l.session_id = ls.id), ls.actual_start),
             COALESCE(ls.actual_start, ls.scheduled_start)
           ) AS last_activity
    FROM live_sessions ls
    WHERE ls.status IN ('live','scheduled')
      -- Only Zoom-backed sessions are closed by inactivity. Sessions started
      -- from the LMS have no Zoom webhooks, so they are closed by
      -- close_stale_app_live_sessions() after 2 hours instead.
      AND ls.zoom_meeting_uuid IS NOT NULL
      AND COALESCE(ls.actual_start, ls.scheduled_start) < now() - interval '10 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM zoom_attendance_logs l
        WHERE l.session_id = ls.id
          AND l.action = 'join_intent'
          AND l.leave_time IS NULL
      )
  )
  UPDATE live_sessions ls
  SET status = 'completed',
      actual_end = COALESCE(ls.actual_end, s.last_activity, now())
  FROM stale s
  WHERE ls.id = s.id;

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$function$;

-- Re-open LMS-started classes that were wrongly auto-closed within the last 2 hours
UPDATE public.live_sessions
SET status = 'live', actual_end = NULL
WHERE status = 'completed'
  AND zoom_meeting_uuid IS NULL
  AND session_source = 'app'
  AND COALESCE(actual_start, scheduled_start, created_at) > now() - interval '2 hours';