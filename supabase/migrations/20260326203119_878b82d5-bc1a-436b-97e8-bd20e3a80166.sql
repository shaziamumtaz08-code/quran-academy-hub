
-- Course Modules table
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course_modules" ON public.course_modules FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_academic'::app_role));

CREATE POLICY "Teachers can view own course modules" ON public.course_modules FOR SELECT
  USING (has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Students can view enrolled course modules" ON public.course_modules FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role) AND is_enrolled_in_course(auth.uid(), course_id));

-- Course Lessons table
CREATE TABLE public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'text',
  content_html text,
  video_url text,
  file_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course_lessons" ON public.course_lessons FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_academic'::app_role));

CREATE POLICY "Teachers can view own course lessons" ON public.course_lessons FOR SELECT
  USING (has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Teachers can update own course lessons" ON public.course_lessons FOR UPDATE
  USING (has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Students can view enrolled course lessons" ON public.course_lessons FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role) AND is_enrolled_in_course(auth.uid(), course_id));

-- Storage bucket for course materials
INSERT INTO storage.buckets (id, name, public) VALUES ('course-materials', 'course-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can manage course materials" ON storage.objects FOR ALL
  USING (bucket_id = 'course-materials' AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Teachers can upload course materials" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'course-materials' AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Anyone authenticated can view course materials" ON storage.objects FOR SELECT
  USING (bucket_id = 'course-materials' AND auth.uid() IS NOT NULL);
