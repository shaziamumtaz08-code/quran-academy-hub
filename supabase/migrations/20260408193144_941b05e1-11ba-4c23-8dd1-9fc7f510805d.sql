
-- Parent profiles
CREATE TABLE public.parent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  phone TEXT,
  relationship TEXT DEFAULT 'guardian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own profile" ON public.parent_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Parents update own profile" ON public.parent_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage parent profiles" ON public.parent_profiles FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_parent_profiles_updated_at BEFORE UPDATE ON public.parent_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Parent-student links
CREATE TABLE public.parent_student_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  notifications_on BOOLEAN NOT NULL DEFAULT true,
  reports_on BOOLEAN NOT NULL DEFAULT true,
  messaging_on BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by UUID,
  UNIQUE(parent_id, student_id)
);
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own links" ON public.parent_student_links FOR SELECT USING (parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage links" ON public.parent_student_links FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Parent reports
CREATE TABLE public.parent_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  read_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own child reports" ON public.parent_reports FOR SELECT USING (
  student_id IN (
    SELECT psl.student_id FROM public.parent_student_links psl
    JOIN public.parent_profiles pp ON psl.parent_id = pp.id
    WHERE pp.user_id = auth.uid()
  )
);
CREATE POLICY "Parents mark reports read" ON public.parent_reports FOR UPDATE USING (
  student_id IN (
    SELECT psl.student_id FROM public.parent_student_links psl
    JOIN public.parent_profiles pp ON psl.parent_id = pp.id
    WHERE pp.user_id = auth.uid()
  )
) WITH CHECK (
  student_id IN (
    SELECT psl.student_id FROM public.parent_student_links psl
    JOIN public.parent_profiles pp ON psl.parent_id = pp.id
    WHERE pp.user_id = auth.uid()
  )
);
CREATE POLICY "Admins manage reports" ON public.parent_reports FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Parent messages
CREATE TABLE public.parent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  student_id UUID NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  sender_role TEXT NOT NULL DEFAULT 'parent',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own messages" ON public.parent_messages FOR SELECT USING (
  parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid())
  OR teacher_id = auth.uid()
);
CREATE POLICY "Parents send messages" ON public.parent_messages FOR INSERT WITH CHECK (
  parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid())
  OR teacher_id = auth.uid()
);
CREATE POLICY "Mark messages read" ON public.parent_messages FOR UPDATE USING (
  parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid())
  OR teacher_id = auth.uid()
);
CREATE POLICY "Admins manage messages" ON public.parent_messages FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Parent notifications
CREATE TABLE public.parent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own notifications" ON public.parent_notifications FOR SELECT USING (
  parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Parents mark notifications read" ON public.parent_notifications FOR UPDATE USING (
  parent_id IN (SELECT id FROM public.parent_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage notifications" ON public.parent_notifications FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_notifications;
