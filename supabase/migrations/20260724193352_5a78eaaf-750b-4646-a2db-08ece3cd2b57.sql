REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_in_chat_group(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_created_chat_group(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.zoom_monitor_teacher_for_license(uuid) FROM anon;