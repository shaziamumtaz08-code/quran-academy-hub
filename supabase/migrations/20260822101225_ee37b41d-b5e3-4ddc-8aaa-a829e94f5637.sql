DROP POLICY IF EXISTS "Anon insert public attempts" ON public.quiz_attempts;
REVOKE INSERT ON public.quiz_attempts FROM anon;