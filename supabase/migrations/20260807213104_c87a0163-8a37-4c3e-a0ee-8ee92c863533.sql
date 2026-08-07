ALTER TABLE public.promotional_posts
  ADD COLUMN IF NOT EXISTS delivery_sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;