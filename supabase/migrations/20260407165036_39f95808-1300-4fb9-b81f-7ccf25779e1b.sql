
-- Lesson planner per course
CREATE TABLE public.course_lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL DEFAULT 1,
  lesson_date DATE DEFAULT NULL,
  topic TEXT NOT NULL DEFAULT '',
  objectives TEXT DEFAULT NULL,
  material_url TEXT DEFAULT NULL,
  material_title TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lesson plans"
  ON public.course_lesson_plans FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view and update lesson plans"
  ON public.course_lesson_plans FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update lesson plan status"
  ON public.course_lesson_plans FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_course_lesson_plans_updated_at
  BEFORE UPDATE ON public.course_lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Teacher guide per course (single doc with version history)
CREATE TABLE public.course_teacher_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
  content_html TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  last_edited_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_teacher_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teacher guides"
  ON public.course_teacher_guides FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view teacher guides"
  ON public.course_teacher_guides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_course_teacher_guides_updated_at
  BEFORE UPDATE ON public.course_teacher_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Version history for teacher guides
CREATE TABLE public.course_teacher_guide_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES public.course_teacher_guides(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_html TEXT NOT NULL,
  edited_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_teacher_guide_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage guide versions"
  ON public.course_teacher_guide_versions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view guide versions"
  ON public.course_teacher_guide_versions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));

-- Badge definitions per course
CREATE TABLE public.course_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'star',
  criteria TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course badges"
  ON public.course_badges FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can view badges"
  ON public.course_badges FOR SELECT
  TO authenticated
  USING (true);

-- Student badge assignments
CREATE TABLE public.course_student_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id UUID NOT NULL REFERENCES public.course_badges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  awarded_by UUID DEFAULT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(badge_id, student_id)
);

ALTER TABLE public.course_student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage student badges"
  ON public.course_student_badges FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own badges"
  ON public.course_student_badges FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
