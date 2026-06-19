
-- QA Test-Mate tables
CREATE TABLE public.qa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,                       -- 'demo_links' | 'rls_isolation' | 'full'
  status TEXT NOT NULL DEFAULT 'running',   -- 'running' | 'passed' | 'failed' | 'error'
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'cron' | 'chat'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  passed_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  summary TEXT,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_runs TO authenticated;
GRANT ALL ON public.qa_runs TO service_role;
ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read qa_runs"
  ON public.qa_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert qa_runs"
  ON public.qa_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_qa_runs_started_at ON public.qa_runs (started_at DESC);

-- Single shared QA chat conversation (super admins only)
CREATE TABLE public.qa_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,                       -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL DEFAULT '',
  parts JSONB,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_chat_messages TO authenticated;
GRANT ALL ON public.qa_chat_messages TO service_role;
ALTER TABLE public.qa_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read qa_chat"
  ON public.qa_chat_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert qa_chat"
  ON public.qa_chat_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete qa_chat"
  ON public.qa_chat_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_qa_chat_created_at ON public.qa_chat_messages (created_at);
