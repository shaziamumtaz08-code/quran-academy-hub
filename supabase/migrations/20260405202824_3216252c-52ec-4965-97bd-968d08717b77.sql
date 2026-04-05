-- Add recording_password column to live_sessions
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_password text;

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;