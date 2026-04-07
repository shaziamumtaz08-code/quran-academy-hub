
-- Classes within a course
CREATE TABLE public.course_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_days TEXT[] NOT NULL DEFAULT '{}',
  schedule_time TIME DEFAULT NULL,
  timezone TEXT DEFAULT 'Asia/Karachi',
  session_duration INTEGER NOT NULL DEFAULT 30,
  meeting_link TEXT DEFAULT NULL,
  zoom_license_id UUID REFERENCES public.zoom_licenses(id) DEFAULT NULL,
  max_seats INTEGER NOT NULL DEFAULT 30,
  class_type TEXT NOT NULL DEFAULT 'regular',
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'PKR',
  is_volunteer BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course classes"
  ON public.course_classes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_course_classes_updated_at
  BEFORE UPDATE ON public.course_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Staff assignments to classes
CREATE TABLE public.course_class_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.course_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  staff_role TEXT NOT NULL DEFAULT 'teacher',
  subjects TEXT[] NOT NULL DEFAULT '{}',
  payout_type TEXT NOT NULL DEFAULT 'per_session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);

ALTER TABLE public.course_class_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage class staff"
  ON public.course_class_staff FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Students in classes
CREATE TABLE public.course_class_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.course_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.course_class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage class students"
  ON public.course_class_students FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
