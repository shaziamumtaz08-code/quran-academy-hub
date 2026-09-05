ALTER TABLE public.course_assignment_submissions
  ADD COLUMN IF NOT EXISTS submission_mode text NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS synced_resource_id uuid REFERENCES public.user_resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_origin text,
  ADD COLUMN IF NOT EXISTS synced_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cas_synced_resource ON public.course_assignment_submissions (synced_resource_id);