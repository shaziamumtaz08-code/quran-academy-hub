
-- Content Kits
CREATE TABLE public.content_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id UUID REFERENCES public.session_plans(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'generating',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage content kits" ON public.content_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Slides
CREATE TABLE public.slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE CASCADE NOT NULL,
  slide_index INTEGER NOT NULL DEFAULT 0,
  phase TEXT,
  layout_type TEXT DEFAULT 'title-bullets',
  title TEXT,
  arabic_text TEXT,
  transliteration TEXT,
  bullets JSONB DEFAULT '[]'::jsonb,
  teacher_note TEXT,
  activity_instruction TEXT,
  edited BOOLEAN DEFAULT false,
  edited_content JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage slides" ON public.slides FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quiz Questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE CASCADE NOT NULL,
  question_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'mcq',
  question TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  blooms_level TEXT DEFAULT 'remember',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage quiz questions" ON public.quiz_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quiz Submissions
CREATE TABLE public.quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  answer TEXT,
  is_correct BOOLEAN,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage quiz submissions" ON public.quiz_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Flashcards
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE CASCADE NOT NULL,
  card_index INTEGER NOT NULL DEFAULT 0,
  arabic TEXT NOT NULL,
  english TEXT NOT NULL,
  transliteration TEXT,
  part_of_speech TEXT,
  example_sentence TEXT,
  example_translation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage flashcards" ON public.flashcards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Flashcard Progress
CREATE TABLE public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'unseen',
  attempts INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage flashcard progress" ON public.flashcard_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Worksheets
CREATE TABLE public.worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  exercises JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage worksheets" ON public.worksheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Kit Shares
CREATE TABLE public.kit_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.content_kits(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID NOT NULL,
  shared_with JSONB DEFAULT '"all"'::jsonb,
  content_types JSONB DEFAULT '[]'::jsonb,
  delivery_channels JSONB DEFAULT '[]'::jsonb,
  message TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kit_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage kit shares" ON public.kit_shares FOR ALL TO authenticated USING (true) WITH CHECK (true);
