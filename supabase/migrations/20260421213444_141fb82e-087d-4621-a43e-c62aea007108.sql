-- Create user_activity_log table for audit trail
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_actor_id ON public.user_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON public.user_activity_log(created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Super admin can read all
CREATE POLICY "Super admins can view all activity logs"
ON public.user_activity_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Users can read their own
CREATE POLICY "Users can view their own activity logs"
ON public.user_activity_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
