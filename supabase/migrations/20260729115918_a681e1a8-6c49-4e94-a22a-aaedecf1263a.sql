CREATE TABLE public.quiz_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_bank_id uuid REFERENCES public.quiz_banks(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'extract',
  stage_message text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_units integer NOT NULL DEFAULT 0,
  processed_units integer NOT NULL DEFAULT 0,
  questions_generated integer NOT NULL DEFAULT 0,
  error text,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_generation_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.quiz_generation_jobs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  label text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_gen_chunks_job ON public.quiz_generation_chunks(job_id, seq);
CREATE INDEX idx_quiz_gen_jobs_creator ON public.quiz_generation_jobs(created_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_generation_jobs TO authenticated;
GRANT ALL ON public.quiz_generation_jobs TO service_role;
GRANT SELECT ON public.quiz_generation_chunks TO authenticated;
GRANT ALL ON public.quiz_generation_chunks TO service_role;

ALTER TABLE public.quiz_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_generation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their quiz jobs"
  ON public.quiz_generation_jobs AS PERMISSIVE FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners view their quiz job chunks"
  ON public.quiz_generation_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_generation_jobs j
    WHERE j.id = quiz_generation_chunks.job_id
      AND (j.created_by = auth.uid() OR public.is_admin(auth.uid()))
  ));

CREATE TRIGGER trg_quiz_gen_jobs_updated_at
  BEFORE UPDATE ON public.quiz_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quiz_generation_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_generation_jobs;