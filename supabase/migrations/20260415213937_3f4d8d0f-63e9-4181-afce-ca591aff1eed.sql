CREATE TABLE IF NOT EXISTS public.virtual_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.course_classes(id) ON DELETE SET NULL,
  room_name TEXT NOT NULL UNIQUE,
  room_token TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  provider TEXT NOT NULL DEFAULT 'zoom',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage virtual sessions" ON public.virtual_sessions FOR ALL TO authenticated USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Teachers manage own sessions" ON public.virtual_sessions FOR ALL TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students view enrolled sessions" ON public.virtual_sessions FOR SELECT TO authenticated USING (course_id IN (SELECT course_id FROM course_enrollments WHERE student_id = auth.uid()));