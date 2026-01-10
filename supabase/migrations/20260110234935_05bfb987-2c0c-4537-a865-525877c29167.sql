-- Fix the INSERT policy to be more restrictive: user can only insert logs for themselves
DROP POLICY "Authenticated users can insert own logs" ON public.system_logs;

CREATE POLICY "Users can insert logs for their own actions"
  ON public.system_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);