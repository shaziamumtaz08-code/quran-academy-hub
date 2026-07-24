REVOKE EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) TO authenticated, service_role;