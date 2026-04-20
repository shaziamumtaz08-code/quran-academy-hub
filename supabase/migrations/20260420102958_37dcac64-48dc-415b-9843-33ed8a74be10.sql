-- Add 'student' role to Shazia Mumtaz since she is enrolled as a student in a course
INSERT INTO public.user_roles (user_id, role)
VALUES ('40d969b5-dd67-4629-a8ca-4ce7bc1c0cce', 'student')
ON CONFLICT (user_id, role) DO NOTHING;