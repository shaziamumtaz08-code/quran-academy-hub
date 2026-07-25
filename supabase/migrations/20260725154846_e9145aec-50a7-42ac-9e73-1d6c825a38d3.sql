
-- Tier enum
DO $$ BEGIN
  CREATE TYPE public.zoom_account_tier AS ENUM ('free', 'licensed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.zoom_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zoom_account_email TEXT NOT NULL,
  zoom_user_id TEXT,
  tier public.zoom_account_tier NOT NULL DEFAULT 'free',
  meeting_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  notes TEXT,
  -- S2S credentials (server-side only; RLS + view protect these)
  zoom_account_id_cred TEXT,
  zoom_client_id TEXT,
  zoom_client_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, tier),
  UNIQUE (zoom_account_email)
);

CREATE INDEX IF NOT EXISTS idx_zoom_accounts_teacher ON public.zoom_accounts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_zoom_accounts_zoom_user ON public.zoom_accounts(zoom_user_id) WHERE zoom_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_accounts_email_lower ON public.zoom_accounts(lower(zoom_account_email));

GRANT SELECT ON public.zoom_accounts TO authenticated;
GRANT ALL ON public.zoom_accounts TO service_role;

ALTER TABLE public.zoom_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all zoom accounts"
ON public.zoom_accounts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers view own zoom accounts"
ON public.zoom_accounts
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

CREATE TRIGGER trg_zoom_accounts_updated
BEFORE UPDATE ON public.zoom_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe view without credentials
CREATE OR REPLACE VIEW public.zoom_accounts_safe AS
SELECT id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link,
       is_active, last_validated_at, notes, created_at, updated_at
FROM public.zoom_accounts;

GRANT SELECT ON public.zoom_accounts_safe TO authenticated;

-- Link new sessions/logs directly to dedicated account
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS zoom_account_id UUID REFERENCES public.zoom_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_zoom_account ON public.live_sessions(zoom_account_id) WHERE zoom_account_id IS NOT NULL;

ALTER TABLE public.zoom_attendance_logs
  ADD COLUMN IF NOT EXISTS zoom_account_id UUID REFERENCES public.zoom_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_attendance_logs_zoom_account ON public.zoom_attendance_logs(zoom_account_id) WHERE zoom_account_id IS NOT NULL;

-- Realtime for the admin control room
ALTER PUBLICATION supabase_realtime ADD TABLE public.zoom_accounts;
