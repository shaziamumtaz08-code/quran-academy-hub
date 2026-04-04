
-- Table for minor/student username + PIN credentials
CREATE TABLE public.minor_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9._-]{3,30}$')
);

-- Index for fast username lookup
CREATE INDEX idx_minor_credentials_username ON public.minor_credentials(username);
CREATE INDEX idx_minor_credentials_profile ON public.minor_credentials(profile_id);

-- Enable RLS
ALTER TABLE public.minor_credentials ENABLE ROW LEVEL SECURITY;

-- Admins can manage all credentials
CREATE POLICY "Admins can manage minor credentials"
ON public.minor_credentials
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- Parents can view/manage their children's credentials
CREATE POLICY "Parents can manage child credentials"
ON public.minor_credentials
FOR ALL
TO authenticated
USING (
  profile_id IN (SELECT public.get_parent_children_ids(auth.uid()))
)
WITH CHECK (
  profile_id IN (SELECT public.get_parent_children_ids(auth.uid()))
);

-- Students can view their own credentials (not update PIN hash)
CREATE POLICY "Students can view own credentials"
ON public.minor_credentials
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Allow anonymous SELECT for login verification via edge function (service role handles this)
-- The edge function uses service_role key so RLS is bypassed there

-- Trigger for updated_at
CREATE TRIGGER update_minor_credentials_updated_at
BEFORE UPDATE ON public.minor_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
