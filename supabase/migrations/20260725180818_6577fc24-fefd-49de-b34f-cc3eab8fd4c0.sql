-- Safety net: auto-close live sessions where nobody is inside anymore.
CREATE OR REPLACE FUNCTION public.close_stale_live_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.close_stale_live_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_stale_live_sessions() TO authenticated, service_role;

-- Run every 5 minutes
SELECT cron.unschedule('close-stale-live-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-stale-live-sessions');

SELECT cron.schedule('close-stale-live-sessions', '*/5 * * * *', $$SELECT public.close_stale_live_sessions();$$);

-- Clear the currently stuck empty room(s) now.
SELECT public.close_stale_live_sessions();