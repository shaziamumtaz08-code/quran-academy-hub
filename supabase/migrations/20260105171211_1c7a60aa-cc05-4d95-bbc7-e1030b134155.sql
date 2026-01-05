-- Create export_audit_logs table for tracking user exports
CREATE TABLE public.export_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_count INTEGER NOT NULL,
    export_type TEXT NOT NULL, -- 'selected', 'filtered', 'all'
    export_format TEXT NOT NULL, -- 'csv', 'xlsx'
    fields_included TEXT[] NOT NULL,
    included_passwords BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.export_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view audit logs
CREATE POLICY "Super admins can view export audit logs"
ON public.export_audit_logs
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Only super_admin can insert audit logs (via edge function with service role)
CREATE POLICY "Service role can insert export audit logs"
ON public.export_audit_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_export_audit_logs_admin_id ON public.export_audit_logs(admin_id);
CREATE INDEX idx_export_audit_logs_exported_at ON public.export_audit_logs(exported_at DESC);