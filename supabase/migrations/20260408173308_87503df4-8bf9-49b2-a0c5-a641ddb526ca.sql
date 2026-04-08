
-- Table: syllabi
CREATE TABLE public.syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  course_name text NOT NULL,
  subject text,
  level text,
  duration_weeks integer,
  sessions_week integer,
  target_audience text,
  learning_goals text,
  source_text text,
  rows jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own syllabi" ON public.syllabi FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users can create own syllabi" ON public.syllabi FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own syllabi" ON public.syllabi FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own syllabi" ON public.syllabi FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_syllabi_updated_at BEFORE UPDATE ON public.syllabi FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: syllabus_exports
CREATE TABLE public.syllabus_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  format text NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  exported_by uuid NOT NULL
);

ALTER TABLE public.syllabus_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports" ON public.syllabus_exports FOR SELECT USING (auth.uid() = exported_by);
CREATE POLICY "Users can create own exports" ON public.syllabus_exports FOR INSERT WITH CHECK (auth.uid() = exported_by);
