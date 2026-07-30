CREATE OR REPLACE FUNCTION public.close_stale_app_live_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.live_sessions ls
    SET status = 'completed',
        actual_end = COALESCE(ls.actual_end, now())
    WHERE ls.status = 'live'
      AND ls.zoom_meeting_uuid IS NULL
      AND COALESCE(ls.actual_start, ls.scheduled_start, ls.created_at) < now() - interval '2 hours'
    RETURNING ls.id
  )
  SELECT count(*) INTO v_count FROM stale;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_stale_app_live_sessions() FROM public;
GRANT EXECUTE ON FUNCTION public.close_stale_app_live_sessions() TO service_role;

SELECT cron.schedule(
  'close-stale-app-live-sessions',
  '*/15 * * * *',
  $$SELECT public.close_stale_app_live_sessions();$$
);

SELECT public.close_stale_app_live_sessions();