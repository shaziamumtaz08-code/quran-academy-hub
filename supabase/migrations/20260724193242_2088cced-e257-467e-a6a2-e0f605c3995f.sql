ALTER TABLE public.zoom_attendance_logs
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS zoom_host_id text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text,
  ADD COLUMN IF NOT EXISTS zoom_event_type text,
  ADD COLUMN IF NOT EXISTS zoom_license_id uuid REFERENCES public.zoom_licenses(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE ON public.zoom_attendance_logs TO authenticated;
GRANT ALL ON public.zoom_attendance_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.zoom_licenses TO authenticated;
GRANT ALL ON public.zoom_licenses TO service_role;

CREATE OR REPLACE FUNCTION public.zoom_monitor_teacher_for_license(_license_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher_id uuid;
BEGIN
  SELECT ls.teacher_id
    INTO _teacher_id
  FROM public.live_sessions ls
  WHERE ls.license_id = _license_id
    AND ls.teacher_id IS NOT NULL
  ORDER BY ls.created_at DESC
  LIMIT 1;

  IF _teacher_id IS NOT NULL THEN
    RETURN _teacher_id;
  END IF;

  SELECT ccs.user_id
    INTO _teacher_id
  FROM public.course_classes cc
  JOIN public.course_class_staff ccs ON ccs.class_id = cc.id
  WHERE cc.zoom_license_id = _license_id
  ORDER BY ccs.created_at DESC NULLS LAST
  LIMIT 1;

  IF _teacher_id IS NOT NULL THEN
    RETURN _teacher_id;
  END IF;

  SELECT ur.user_id
    INTO _teacher_id
  FROM public.user_roles ur
  WHERE ur.role = 'teacher'::public.app_role
  ORDER BY ur.created_at DESC NULLS LAST
  LIMIT 1;

  IF _teacher_id IS NOT NULL THEN
    RETURN _teacher_id;
  END IF;

  SELECT ur.user_id
    INTO _teacher_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ORDER BY ur.created_at DESC NULLS LAST
  LIMIT 1;

  RETURN _teacher_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_chat_group(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_created_chat_group(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Admin can view all attendance logs" ON public.zoom_attendance_logs;
DROP POLICY IF EXISTS "Teachers can view logs for their sessions" ON public.zoom_attendance_logs;
DROP POLICY IF EXISTS "Users can view own attendance logs" ON public.zoom_attendance_logs;
DROP POLICY IF EXISTS "Users can log their own attendance" ON public.zoom_attendance_logs;

CREATE POLICY "Admin can view all attendance logs"
ON public.zoom_attendance_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view logs for their sessions"
ON public.zoom_attendance_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (
    user_id = auth.uid()
    OR session_id IN (
      SELECT ls.id FROM public.live_sessions ls WHERE ls.teacher_id = auth.uid()
    )
    OR zoom_license_id IN (
      SELECT ls.license_id FROM public.live_sessions ls WHERE ls.teacher_id = auth.uid() AND ls.license_id IS NOT NULL
    )
  )
);

CREATE POLICY "Users can view own attendance logs"
ON public.zoom_attendance_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can log their own attendance"
ON public.zoom_attendance_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

WITH busy AS (
  SELECT zl.id AS license_id,
         zl.host_id,
         public.zoom_monitor_teacher_for_license(zl.id) AS teacher_id,
         zl.last_used_at
  FROM public.zoom_licenses zl
  WHERE zl.status = 'busy'
    AND NOT EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      WHERE ls.license_id = zl.id
        AND ls.status IN ('live', 'scheduled')
    )
)
INSERT INTO public.live_sessions (
  teacher_id,
  scheduled_start,
  actual_start,
  status,
  license_id,
  zoom_meeting_uuid,
  recording_status
)
SELECT teacher_id,
       COALESCE(last_used_at, now()),
       COALESCE(last_used_at, now()),
       'live'::public.session_status,
       license_id,
       NULL,
       'pending'
FROM busy
WHERE teacher_id IS NOT NULL;