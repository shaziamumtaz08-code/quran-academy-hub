ALTER TABLE public.quiz_sessions ADD COLUMN IF NOT EXISTS identity_mode text NOT NULL DEFAULT 'email';
ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_identity_mode_check;
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_identity_mode_check CHECK (identity_mode IN ('email','name'));