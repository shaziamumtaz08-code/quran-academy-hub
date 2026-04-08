
-- Speaking drills
CREATE TABLE public.speaking_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  level TEXT DEFAULT 'beginner',
  created_by UUID,
  is_library BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.speaking_drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view speaking drills" ON public.speaking_drills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert speaking drills" ON public.speaking_drills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Creators manage drills" ON public.speaking_drills FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins manage all drills" ON public.speaking_drills FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Drill phrases
CREATE TABLE public.drill_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES public.speaking_drills(id) ON DELETE CASCADE,
  phrase_arabic TEXT NOT NULL,
  romanised TEXT,
  english TEXT,
  audio_url TEXT,
  difficulty INTEGER DEFAULT 1,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drill_phrases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view drill phrases" ON public.drill_phrases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert drill phrases" ON public.drill_phrases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update drill phrases" ON public.drill_phrases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete drill phrases" ON public.drill_phrases FOR DELETE TO authenticated USING (true);

-- Speaking attempts
CREATE TABLE public.speaking_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  phrase_id UUID REFERENCES public.drill_phrases(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  assignment_id UUID,
  audio_url TEXT,
  transcription TEXT,
  overall_score INTEGER DEFAULT 0,
  pronunciation INTEGER DEFAULT 0,
  fluency INTEGER DEFAULT 0,
  word_breakdown JSONB DEFAULT '[]'::jsonb,
  feedback TEXT,
  tip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.speaking_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts" ON public.speaking_attempts FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Users create own attempts" ON public.speaking_attempts FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Admins view all attempts" ON public.speaking_attempts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Phrase mastery
CREATE TABLE public.phrase_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  phrase_id UUID NOT NULL REFERENCES public.drill_phrases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  last_score INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  mastered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, phrase_id)
);
ALTER TABLE public.phrase_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own mastery" ON public.phrase_mastery FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Users manage own mastery" ON public.phrase_mastery FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Admins view all mastery" ON public.phrase_mastery FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Speaking conversations
CREATE TABLE public.speaking_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  session_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  assignment_id UUID,
  messages JSONB DEFAULT '[]'::jsonb,
  vocab_used JSONB DEFAULT '[]'::jsonb,
  duration_sec INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE public.speaking_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own conversations" ON public.speaking_conversations FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Users manage own conversations" ON public.speaking_conversations FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Admins view all conversations" ON public.speaking_conversations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Speaking assignments
CREATE TABLE public.speaking_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  created_by UUID,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'drill',
  phrase_ids JSONB DEFAULT '[]'::jsonb,
  assigned_to JSONB DEFAULT '"all"'::jsonb,
  due_at TIMESTAMPTZ,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.speaking_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view assignments" ON public.speaking_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert assignments" ON public.speaking_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Creators manage assignments" ON public.speaking_assignments FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins manage all assignments" ON public.speaking_assignments FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Speaking assignment submissions
CREATE TABLE public.speaking_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.speaking_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  final_score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.speaking_assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own submissions" ON public.speaking_assignment_submissions FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Users manage own submissions" ON public.speaking_assignment_submissions FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Admins view all submissions" ON public.speaking_assignment_submissions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_drill_phrases_drill ON public.drill_phrases(drill_id);
CREATE INDEX idx_speaking_attempts_student ON public.speaking_attempts(student_id);
CREATE INDEX idx_speaking_attempts_phrase ON public.speaking_attempts(phrase_id);
CREATE INDEX idx_phrase_mastery_student ON public.phrase_mastery(student_id);
CREATE INDEX idx_speaking_conversations_student ON public.speaking_conversations(student_id);
CREATE INDEX idx_speaking_assignment_subs_assignment ON public.speaking_assignment_submissions(assignment_id);
