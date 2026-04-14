
-- Quiz Banks: stores the AI-generated question pool + config
CREATE TABLE public.quiz_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  question_mix JSONB NOT NULL DEFAULT '{"mcq": 5, "tf": 3, "fib": 2}',
  source_content TEXT,
  question_bank JSONB NOT NULL DEFAULT '[]',
  questions_per_attempt INT NOT NULL DEFAULT 10,
  time_limit_minutes INT,
  max_attempts INT DEFAULT 1,
  passing_percentage NUMERIC(5,2) DEFAULT 50,
  mode TEXT NOT NULL DEFAULT 'authenticated' CHECK (mode IN ('authenticated', 'public')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_banks ENABLE ROW LEVEL SECURITY;

-- Quiz Sessions: a published instance of a quiz bank (with unique link for public mode)
CREATE TABLE public.quiz_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_bank_id UUID NOT NULL REFERENCES public.quiz_banks(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'closed')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Quiz Attempts: student submissions
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  quiz_bank_id UUID NOT NULL REFERENCES public.quiz_banks(id) ON DELETE CASCADE,
  student_id UUID,
  guest_email TEXT,
  guest_name TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '{}',
  score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  time_taken_seconds INT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_quiz_banks_course ON public.quiz_banks(course_id);
CREATE INDEX idx_quiz_sessions_bank ON public.quiz_sessions(quiz_bank_id);
CREATE INDEX idx_quiz_sessions_token ON public.quiz_sessions(access_token);
CREATE INDEX idx_quiz_attempts_session ON public.quiz_attempts(session_id);
CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_email ON public.quiz_attempts(guest_email);

-- Trigger for updated_at
CREATE TRIGGER update_quiz_banks_updated_at BEFORE UPDATE ON public.quiz_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_sessions_updated_at BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- quiz_banks: admins & course staff can manage
CREATE POLICY "Admins manage quiz banks" ON public.quiz_banks
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Course staff manage quiz banks" ON public.quiz_banks
  FOR ALL TO authenticated
  USING (public.is_course_staff(auth.uid(), course_id));

CREATE POLICY "Students view published quiz banks" ON public.quiz_banks
  FOR SELECT TO authenticated
  USING (status = 'published' AND mode = 'authenticated' AND public.is_enrolled_in_course(auth.uid(), course_id));

-- quiz_sessions: same pattern
CREATE POLICY "Admins manage quiz sessions" ON public.quiz_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Course staff manage sessions" ON public.quiz_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_banks qb
    WHERE qb.id = quiz_bank_id AND public.is_course_staff(auth.uid(), qb.course_id)
  ));

CREATE POLICY "Students view live sessions" ON public.quiz_sessions
  FOR SELECT TO authenticated
  USING (status = 'live' AND EXISTS (
    SELECT 1 FROM public.quiz_banks qb
    WHERE qb.id = quiz_bank_id AND qb.mode = 'authenticated' AND public.is_enrolled_in_course(auth.uid(), qb.course_id)
  ));

-- quiz_attempts: users see own, admins see all
CREATE POLICY "Users view own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Users create own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Users update own in-progress attempts" ON public.quiz_attempts
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'in_progress');

CREATE POLICY "Admins manage all attempts" ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Course staff view attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_banks qb
    WHERE qb.id = quiz_bank_id AND public.is_course_staff(auth.uid(), qb.course_id)
  ));

-- Public access for quiz sessions (anon can read live public sessions via edge function)
CREATE POLICY "Anon read public live sessions" ON public.quiz_sessions
  FOR SELECT TO anon
  USING (status = 'live');

CREATE POLICY "Anon read public quiz banks" ON public.quiz_banks
  FOR SELECT TO anon
  USING (status = 'published' AND mode = 'public');

CREATE POLICY "Anon insert public attempts" ON public.quiz_attempts
  FOR INSERT TO anon
  WITH CHECK (student_id IS NULL AND guest_email IS NOT NULL);

CREATE POLICY "Anon read own attempts by email" ON public.quiz_attempts
  FOR SELECT TO anon
  USING (student_id IS NULL);
