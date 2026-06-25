REVOKE EXECUTE ON FUNCTION public.get_student_dashboard_context(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_assignment_dm(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_dashboard_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_assignment_dm(uuid, uuid, text, text) TO authenticated;