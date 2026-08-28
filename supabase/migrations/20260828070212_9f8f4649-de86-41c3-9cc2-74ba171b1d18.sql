CREATE OR REPLACE FUNCTION public.close_stale_app_live_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.live_sessions ls
    SET status = 'completed',
        actual_end = COALESCE(ls.actual_end, now())
    WHERE ls.status = 'live'
      AND ls.zoom_meeting_uuid IS NULL
      AND COALESCE(ls.actual_start, ls.scheduled_start, ls.created_at)
          < now() - (
            COALESCE(
              (SELECT s.duration_minutes FROM public.schedules s WHERE s.id = ls.schedule_id),
              (SELECT a.duration_minutes FROM public.student_teacher_assignments a WHERE a.id = ls.assignment_id),
              60
            ) + 15
          ) * interval '1 minute'
    RETURNING ls.id
  )
  SELECT count(*) INTO v_count FROM stale;
  RETURN v_count;
END;
$function$;