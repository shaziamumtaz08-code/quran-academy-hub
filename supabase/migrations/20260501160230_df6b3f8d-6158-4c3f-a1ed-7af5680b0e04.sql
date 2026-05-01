INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT spl.parent_id, 'parent'::app_role
FROM public.student_parent_links spl
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = spl.parent_id AND ur.role = 'parent'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;