-- Create system_logs table for human-readable identity audit trail
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_full_name TEXT NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX idx_system_logs_action ON public.system_logs(action);
CREATE INDEX idx_system_logs_entity_type ON public.system_logs(entity_type);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view logs
CREATE POLICY "Super admin can view all logs"
  ON public.system_logs
  FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can view all logs"
  ON public.system_logs
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Any authenticated user can insert logs (for their own actions)
CREATE POLICY "Authenticated users can insert own logs"
  ON public.system_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE public.system_logs IS 'Audit trail for tracking user actions with human-readable identities (Full Name + Email) captured at action time for historical accuracy';