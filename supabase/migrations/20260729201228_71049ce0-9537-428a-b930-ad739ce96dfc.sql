ALTER TABLE public.zoom_accounts ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE public.zoom_accounts ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.zoom_accounts ADD COLUMN IF NOT EXISTS shared_purposes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.zoom_accounts ADD COLUMN IF NOT EXISTS auto_record boolean NOT NULL DEFAULT false;
ALTER TABLE public.zoom_accounts ADD COLUMN IF NOT EXISTS display_label text;
CREATE UNIQUE INDEX IF NOT EXISTS zoom_accounts_shared_email_uniq
  ON public.zoom_accounts (lower(zoom_account_email)) WHERE is_shared;