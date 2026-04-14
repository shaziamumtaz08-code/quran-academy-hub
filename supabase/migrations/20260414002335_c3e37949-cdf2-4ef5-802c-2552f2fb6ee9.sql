-- Create course_outlines table
CREATE TABLE public.course_outlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  source_filename TEXT,
  day_number INTEGER NOT NULL,
  day_name TEXT,
  session_date DATE,
  chapter_number INTEGER,
  chapter_title TEXT,
  topic TEXT,
  page_start INTEGER,
  page_end INTEGER,
  duration_minutes INTEGER DEFAULT 45,
  notes TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create source_files table
CREATE TABLE public.source_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  page_count INTEGER,
  extracted_text TEXT,
  detected_chapters JSONB DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add outline_day_id to session_plans
ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS outline_day_id UUID REFERENCES public.course_outlines(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.course_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for course_outlines
CREATE POLICY "Authenticated users can view outlines"
  ON public.course_outlines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create outlines"
  ON public.course_outlines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update outlines"
  ON public.course_outlines FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete outlines"
  ON public.course_outlines FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- RLS policies for source_files
CREATE POLICY "Authenticated users can view source files"
  ON public.source_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create source files"
  ON public.source_files FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update source files"
  ON public.source_files FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete source files"
  ON public.source_files FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_course_outlines_course ON public.course_outlines(course_id);
CREATE INDEX idx_course_outlines_day ON public.course_outlines(course_id, day_number);
CREATE INDEX idx_source_files_course ON public.source_files(course_id);