-- 1. push_tokens table
CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. channel is TEXT with a CHECK constraint -- widen it to allow 'push'
ALTER TABLE public.notification_templates
  DROP CONSTRAINT IF EXISTS notification_templates_channel_check;
ALTER TABLE public.notification_templates
  ADD CONSTRAINT notification_templates_channel_check
  CHECK (channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text, 'in_app'::text, 'push'::text]));

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_channel_check;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_channel_check
  CHECK (channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text, 'in_app'::text, 'push'::text]));

-- 3. created_at index already exists (idx_notification_events_created); ensure it for safety
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON public.notification_events (created_at DESC);