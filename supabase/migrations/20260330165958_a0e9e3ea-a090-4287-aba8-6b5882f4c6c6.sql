
-- ═══════════════════════════════════════════════════════════════
-- PHASE 1: Extend courses table with marketing/website fields
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level text DEFAULT 'All Levels';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS outcomes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS ad_creative jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS support_messages jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS syllabus_text text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS pricing jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS website_enabled boolean DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS seo_slug text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS enrollment_type text DEFAULT 'admin_only';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: Course Library Assets (reusable multi-type items)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.course_library_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  asset_type text NOT NULL DEFAULT 'document',
  content_url text,
  content_html text,
  metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  status text DEFAULT 'draft',
  version integer DEFAULT 1,
  owner_id uuid REFERENCES public.profiles(id),
  visibility text DEFAULT 'internal',
  course_id uuid REFERENCES public.courses(id),
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.course_library_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage library assets" ON public.course_library_assets
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_academic'::app_role));

CREATE POLICY "Teachers can view and manage own assets" ON public.course_library_assets
  FOR ALL TO public
  USING (has_role(auth.uid(), 'teacher'::app_role) AND owner_id = auth.uid());

CREATE POLICY "Students can view published course assets" ON public.course_library_assets
  FOR SELECT TO public
  USING (status = 'published' AND visibility = 'public');

-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Course Posts (announcements + discussions + support)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.course_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  post_type text NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  content text,
  is_pinned boolean DEFAULT false,
  is_approved boolean DEFAULT true,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.course_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all posts" ON public.course_posts
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_academic'::app_role));

CREATE POLICY "Teachers can manage posts for own courses" ON public.course_posts
  FOR ALL TO public
  USING (has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Enrolled students can view approved posts" ON public.course_posts
  FOR SELECT TO public
  USING (has_role(auth.uid(), 'student'::app_role) AND is_approved = true AND is_enrolled_in_course(auth.uid(), course_id));

CREATE POLICY "Enrolled students can create discussion posts" ON public.course_posts
  FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'student'::app_role) AND post_type = 'discussion' AND is_enrolled_in_course(auth.uid(), course_id));

CREATE TABLE IF NOT EXISTS public.course_post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.course_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  is_approved boolean DEFAULT true,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.course_post_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all replies" ON public.course_post_replies
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can manage replies on own course posts" ON public.course_post_replies
  FOR ALL TO public
  USING (has_role(auth.uid(), 'teacher'::app_role) AND post_id IN (
    SELECT cp.id FROM public.course_posts cp JOIN public.courses c ON cp.course_id = c.id WHERE c.teacher_id = auth.uid()
  ));

CREATE POLICY "Enrolled students can view approved replies" ON public.course_post_replies
  FOR SELECT TO public
  USING (has_role(auth.uid(), 'student'::app_role) AND is_approved = true AND post_id IN (
    SELECT id FROM public.course_posts WHERE is_enrolled_in_course(auth.uid(), course_id)
  ));

CREATE POLICY "Enrolled students can create replies" ON public.course_post_replies
  FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'student'::app_role) AND author_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- PHASE 4: Public access policy for website-enabled courses
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Public can view website-enabled courses" ON public.courses
  FOR SELECT TO anon
  USING (website_enabled = true AND status = 'active');

-- Enable realtime for course posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_post_replies;
