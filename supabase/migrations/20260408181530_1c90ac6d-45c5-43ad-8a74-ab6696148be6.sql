
CREATE TABLE public.session_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  syllabus_id UUID NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  session_number INTEGER NOT NULL,
  session_date DATE,
  session_day TEXT,
  session_title TEXT,
  session_objective TEXT,
  total_minutes INTEGER DEFAULT 45,
  activities JSONB DEFAULT '[]'::jsonb,
  teacher_notes TEXT,
  homework_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(syllabus_id, week_number, session_number)
);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session plans"
  ON public.session_plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.syllabi s WHERE s.id = syllabus_id AND s.user_id = auth.uid()));

CREATE POLICY "Users can create own session plans"
  ON public.session_plans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.syllabi s WHERE s.id = syllabus_id AND s.user_id = auth.uid()));

CREATE POLICY "Users can update own session plans"
  ON public.session_plans FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.syllabi s WHERE s.id = syllabus_id AND s.user_id = auth.uid()));

CREATE POLICY "Users can delete own session plans"
  ON public.session_plans FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.syllabi s WHERE s.id = syllabus_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_session_plans_updated_at
  BEFORE UPDATE ON public.session_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_session_plans_syllabus ON public.session_plans(syllabus_id);
