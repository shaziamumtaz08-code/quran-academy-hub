
-- Session logs for live teaching
CREATE TABLE public.session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_plan_id UUID NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actual_duration INTEGER,
  activities_done INTEGER DEFAULT 0,
  activities_total INTEGER DEFAULT 0,
  students_present INTEGER DEFAULT 0,
  session_notes TEXT,
  status TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session logs"
  ON public.session_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.session_plans sp
    JOIN public.syllabi s ON s.id = sp.syllabus_id
    WHERE sp.id = session_plan_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own session logs"
  ON public.session_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.session_plans sp
    JOIN public.syllabi s ON s.id = sp.syllabus_id
    WHERE sp.id = session_plan_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own session logs"
  ON public.session_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.session_plans sp
    JOIN public.syllabi s ON s.id = sp.syllabus_id
    WHERE sp.id = session_plan_id AND s.user_id = auth.uid()
  ));

CREATE TRIGGER update_session_logs_updated_at
  BEFORE UPDATE ON public.session_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_session_logs_plan ON public.session_logs(session_plan_id);

-- Enable realtime for session_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_logs;

-- Student signals during live sessions
CREATE TABLE public.student_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_log_id UUID NOT NULL REFERENCES public.session_logs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  signal_type TEXT NOT NULL DEFAULT 'raise_hand',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view signals"
  ON public.student_signals FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Students can create signals"
  ON public.student_signals FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE INDEX idx_student_signals_log ON public.student_signals(session_log_id);

-- Enable realtime for student signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_signals;

-- AI assist logs
CREATE TABLE public.ai_assists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_plan_id UUID NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  activity_index INTEGER NOT NULL DEFAULT 0,
  assist_type TEXT NOT NULL DEFAULT 'assistant',
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_assists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai assists"
  ON public.ai_assists FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.session_plans sp
    JOIN public.syllabi s ON s.id = sp.syllabus_id
    WHERE sp.id = session_plan_id AND s.user_id = auth.uid()
  ));

CREATE INDEX idx_ai_assists_plan ON public.ai_assists(session_plan_id);
