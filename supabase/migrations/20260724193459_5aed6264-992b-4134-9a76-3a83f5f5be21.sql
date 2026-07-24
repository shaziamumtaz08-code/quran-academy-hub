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
    AND (ls.assignment_id IS NOT NULL OR ls.schedule_id IS NOT NULL)
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
REVOKE EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) TO authenticated, service_role;