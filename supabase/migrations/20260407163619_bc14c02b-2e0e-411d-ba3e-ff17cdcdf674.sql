
-- Promotional posts for course marketing
CREATE TABLE public.promotional_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  attachment_url TEXT DEFAULT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promotional_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promotional posts"
  ON public.promotional_posts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_promotional_posts_updated_at
  BEFORE UPDATE ON public.promotional_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message sequences for automated reminders
CREATE TABLE public.course_message_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT DEFAULT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  delay_rule TEXT NOT NULL DEFAULT 'before_start',
  delay_days INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_message_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage message sequences"
  ON public.course_message_sequences FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_course_message_sequences_updated_at
  BEFORE UPDATE ON public.course_message_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
