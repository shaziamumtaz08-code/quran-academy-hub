ALTER TABLE public.course_assignment_submissions
  ADD COLUMN IF NOT EXISTS feedback_voice_url text,
  ADD COLUMN IF NOT EXISTS annotations jsonb NOT NULL DEFAULT '[]'::jsonb;