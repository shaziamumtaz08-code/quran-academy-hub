ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS remarks_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS remarks_flag_reason text,
  ADD COLUMN IF NOT EXISTS remarks_auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remarks_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_exams_remarks_status ON public.exams (remarks_status) WHERE remarks_status = 'needs_review';