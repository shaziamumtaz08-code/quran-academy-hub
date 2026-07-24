WITH current_live AS (
  SELECT ls.id AS session_id,
         ls.license_id,
         zl.host_id
  FROM public.live_sessions ls
  JOIN public.zoom_licenses zl ON zl.id = ls.license_id
  WHERE ls.status = 'live'
    AND zl.status = 'busy'
  ORDER BY ls.created_at DESC
  LIMIT 1
)
UPDATE public.zoom_attendance_logs zal
SET session_id = COALESCE(zal.session_id, current_live.session_id),
    zoom_license_id = COALESCE(zal.zoom_license_id, current_live.license_id),
    zoom_host_id = COALESCE(zal.zoom_host_id, current_live.host_id),
    zoom_event_type = COALESCE(zal.zoom_event_type, 'meeting.participant_joined')
FROM current_live
WHERE zal.session_id IS NULL
  AND zal.timestamp > now() - interval '30 minutes';