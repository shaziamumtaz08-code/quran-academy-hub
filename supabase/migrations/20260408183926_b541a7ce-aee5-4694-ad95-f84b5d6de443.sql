
-- Teaching OS exams
CREATE TABLE public.teaching_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID,
  title TEXT NOT NULL DEFAULT 'Untitled Exam',
  instructions TEXT,
  duration_minutes INTEGER,
  pass_mark_percent INTEGER DEFAULT 60,
  total_marks INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  settings JSONB DEFAULT '{"randomise_questions": false, "randomise_options": false, "max_attempts": 1, "show_score_immediately": true, "show_answers_after": "after_close", "paged_mode": false}'::jsonb,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view teaching exams" ON public.teaching_exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators manage teaching exams" ON public.teaching_exams FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins manage all teaching exams" ON public.teaching_exams FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER update_teaching_exams_updated_at BEFORE UPDATE ON public.teaching_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Teaching OS exam questions
CREATE TABLE public.teaching_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.teaching_exams(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  model_answer TEXT,
  scenario_context TEXT,
  blank_sentence TEXT,
  rubric JSONB,
  points INTEGER NOT NULL DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
  blooms_level TEXT DEFAULT 'remember',
  auto_mark BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view teaching exam questions" ON public.teaching_exam_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Exam creators manage questions" ON public.teaching_exam_questions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.teaching_exams e WHERE e.id = exam_id AND e.created_by = auth.uid()));
CREATE POLICY "Admins manage all teaching questions" ON public.teaching_exam_questions FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Teaching OS exam submissions
CREATE TABLE public.teaching_exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.teaching_exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  total_score INTEGER DEFAULT 0,
  total_possible INTEGER DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  passed BOOLEAN,
  time_taken_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_exam_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own teaching submissions" ON public.teaching_exam_submissions FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Students create own teaching submissions" ON public.teaching_exam_submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students update own teaching submissions" ON public.teaching_exam_submissions FOR UPDATE TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers view all teaching submissions" ON public.teaching_exam_submissions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.teaching_exams e WHERE e.id = exam_id AND e.created_by = auth.uid()));
CREATE POLICY "Admins manage all teaching submissions" ON public.teaching_exam_submissions FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Teaching OS exam responses
CREATE TABLE public.teaching_exam_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.teaching_exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.teaching_exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN,
  score_awarded INTEGER DEFAULT 0,
  ai_score INTEGER,
  ai_feedback TEXT,
  ai_confidence INTEGER,
  teacher_score INTEGER,
  teacher_feedback TEXT,
  teacher_reviewed BOOLEAN DEFAULT false,
  rubric_breakdown JSONB,
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_exam_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own teaching responses" ON public.teaching_exam_responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.teaching_exam_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid()));
CREATE POLICY "Students create own teaching responses" ON public.teaching_exam_responses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.teaching_exam_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid()));
CREATE POLICY "Students update own teaching responses" ON public.teaching_exam_responses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.teaching_exam_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid()));
CREATE POLICY "Teachers view all teaching responses" ON public.teaching_exam_responses FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.teaching_exam_submissions s JOIN public.teaching_exams e ON e.id = s.exam_id WHERE s.id = submission_id AND e.created_by = auth.uid()));
CREATE POLICY "Admins manage all teaching responses" ON public.teaching_exam_responses FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Assessment insights
CREATE TABLE public.assessment_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.teaching_exams(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'weakness',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_students INTEGER DEFAULT 0,
  affected_percent NUMERIC DEFAULT 0,
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  applied_to_plan BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view assessment insights" ON public.assessment_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage assessment insights" ON public.assessment_insights FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Exam creators manage insights" ON public.assessment_insights FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.teaching_exams e WHERE e.id = exam_id AND e.created_by = auth.uid()));

-- Indexes
CREATE INDEX idx_teaching_exam_questions_exam ON public.teaching_exam_questions(exam_id);
CREATE INDEX idx_teaching_exam_submissions_exam ON public.teaching_exam_submissions(exam_id);
CREATE INDEX idx_teaching_exam_submissions_student ON public.teaching_exam_submissions(student_id);
CREATE INDEX idx_teaching_exam_responses_submission ON public.teaching_exam_responses(submission_id);
CREATE INDEX idx_assessment_insights_exam ON public.assessment_insights(exam_id);
