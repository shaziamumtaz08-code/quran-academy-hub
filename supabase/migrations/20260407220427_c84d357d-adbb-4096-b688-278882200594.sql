
-- Course Quizzes
CREATE TABLE public.course_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER,
  passing_percentage NUMERIC DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published quizzes"
ON public.course_quizzes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and teachers can manage quizzes"
ON public.course_quizzes FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR created_by = auth.uid());

-- Quiz Questions
CREATE TABLE public.course_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  points NUMERIC NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quiz questions"
ON public.course_quiz_questions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins/teachers manage quiz questions"
ON public.course_quiz_questions FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Quiz Attempts
CREATE TABLE public.course_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  answers JSONB DEFAULT '{}'::jsonb,
  score NUMERIC DEFAULT 0,
  max_score NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own attempts"
ON public.course_quiz_attempts FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Students create own attempts"
ON public.course_quiz_attempts FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins manage all attempts"
ON public.course_quiz_attempts FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Certificate Templates
CREATE TABLE public.course_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_html TEXT DEFAULT '',
  background_image_url TEXT,
  fields JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view certificates"
ON public.course_certificates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage certificates"
ON public.course_certificates FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Certificate Awards
CREATE TABLE public.course_certificate_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES public.course_certificates(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade TEXT,
  custom_text TEXT,
  certificate_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_certificate_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own awards"
ON public.course_certificate_awards FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage awards"
ON public.course_certificate_awards FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_course_quizzes_updated_at
BEFORE UPDATE ON public.course_quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_certificates_updated_at
BEFORE UPDATE ON public.course_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
