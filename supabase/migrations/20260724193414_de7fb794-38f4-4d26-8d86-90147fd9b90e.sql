WITH active AS (
  SELECT ls.id AS session_id, ls.license_id
  FROM public.live_sessions ls
  JOIN public.zoom_licenses zl ON zl.id = ls.license_id
  WHERE zl.status = 'busy'
    AND ls.status = 'live'
  ORDER BY ls.created_at DESC
  LIMIT 1
)
UPDATE public.zoom_attendance_logs zal
SET session_id = active.session_id,
    zoom_license_id = COALESCE(zal.zoom_license_id, active.license_id)
FROM active
WHERE zal.session_id IS NULL
  AND zal.zoom_license_id = active.license_id;