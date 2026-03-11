CREATE TABLE public.course_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'Arabic',
  level TEXT NOT NULL DEFAULT 'Beginner',
  ad_creative JSONB NOT NULL DEFAULT '{}',
  support_messages JSONB NOT NULL DEFAULT '{}',
  syllabus TEXT,
  runs JSONB NOT NULL DEFAULT '[]',
  linked_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.course_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course assets" ON public.course_assets
  FOR ALL USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'admin_academic')
  );

CREATE POLICY "Teachers can view course assets" ON public.course_assets
  FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_course_assets_updated_at
  BEFORE UPDATE ON public.course_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();