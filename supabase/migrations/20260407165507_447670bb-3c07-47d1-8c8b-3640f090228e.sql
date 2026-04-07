
-- Assignments per course
CREATE TABLE public.course_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT DEFAULT NULL,
  due_date TIMESTAMPTZ DEFAULT NULL,
  file_url TEXT DEFAULT NULL,
  file_name TEXT DEFAULT NULL,
  created_by UUID DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course assignments"
  ON public.course_assignments FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can manage their course assignments"
  ON public.course_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Enrolled students can view assignments"
  ON public.course_assignments FOR SELECT
  TO authenticated
  USING (public.is_enrolled_in_course(auth.uid(), course_id));

CREATE TRIGGER update_course_assignments_updated_at
  BEFORE UPDATE ON public.course_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Student submissions
CREATE TABLE public.course_assignment_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.course_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  response_text TEXT DEFAULT NULL,
  file_url TEXT DEFAULT NULL,
  file_name TEXT DEFAULT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted',
  feedback TEXT DEFAULT NULL,
  graded_by UUID DEFAULT NULL,
  graded_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.course_assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage submissions"
  ON public.course_assignment_submissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view and update submissions"
  ON public.course_assignment_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students can manage their own submissions"
  ON public.course_assignment_submissions FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE TRIGGER update_course_assignment_submissions_updated_at
  BEFORE UPDATE ON public.course_assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Course notifications log
CREATE TABLE public.course_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT DEFAULT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  sent_by UUID DEFAULT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course notifications"
  ON public.course_notifications FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can manage course notifications"
  ON public.course_notifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Enrolled students can view notifications"
  ON public.course_notifications FOR SELECT
  TO authenticated
  USING (public.is_enrolled_in_course(auth.uid(), course_id));

-- Add WhatsApp channel link to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS whatsapp_channel_link TEXT DEFAULT NULL;
