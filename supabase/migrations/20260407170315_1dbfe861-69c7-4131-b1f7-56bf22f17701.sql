
ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS channel_mode TEXT NOT NULL DEFAULT 'group';
