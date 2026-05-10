DROP POLICY IF EXISTS "Students can view live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Parents can view children sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Students can view assigned teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view children teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students view recordings via assignment" ON public.session_recordings;