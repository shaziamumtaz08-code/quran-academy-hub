-- Create org_auth_config table
CREATE TABLE IF NOT EXISTS public.org_auth_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  method text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  is_supported boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (org_id, method)
);

CREATE INDEX IF NOT EXISTS idx_org_auth_config_org ON public.org_auth_config(org_id);

-- Enforce only one default per org
CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_auth_default
  ON public.org_auth_config(org_id) WHERE is_default = true;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_org_auth_config_updated_at ON public.org_auth_config;
CREATE TRIGGER trg_org_auth_config_updated_at
BEFORE UPDATE ON public.org_auth_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.org_auth_config ENABLE ROW LEVEL SECURITY;

-- Public read (login page must work pre-auth)
CREATE POLICY "Anyone can view org auth config"
ON public.org_auth_config FOR SELECT
USING (true);

-- Admin/super_admin manage
CREATE POLICY "Admins can insert org auth config"
ON public.org_auth_config FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update org auth config"
ON public.org_auth_config FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete org auth config"
ON public.org_auth_config FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Seed defaults for every existing org
INSERT INTO public.org_auth_config (org_id, method, enabled, is_default, is_supported)
SELECT o.id, m.method, m.enabled, m.is_default, m.is_supported
FROM public.organizations o
CROSS JOIN (VALUES
  ('email_password', true,  true,  true),
  ('uid_pin',        true,  false, true),
  ('google',         false, false, true),
  ('magic_link',     true,  false, true),
  ('microsoft',      false, false, false),
  ('whatsapp_otp',   false, false, false)
) AS m(method, enabled, is_default, is_supported)
ON CONFLICT (org_id, method) DO NOTHING;