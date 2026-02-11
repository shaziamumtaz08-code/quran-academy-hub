
-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  subject_id UUID REFERENCES public.subjects(id),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  max_students INTEGER NOT NULL DEFAULT 30,
  is_group_class BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course_enrollments table
CREATE TABLE public.course_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS for courses
CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'admin_academic')
  );

CREATE POLICY "Teachers can view their courses" ON public.courses
  FOR SELECT USING (
    public.has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid()
  );

CREATE POLICY "Students can view courses they are enrolled in" ON public.courses
  FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce 
      WHERE ce.course_id = id AND ce.student_id = auth.uid() AND ce.status = 'active'
    )
  );

-- RLS for course_enrollments
CREATE POLICY "Admins can manage course enrollments" ON public.course_enrollments
  FOR ALL USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'admin_academic')
  );

CREATE POLICY "Teachers can view enrollments for their courses" ON public.course_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.id = course_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments" ON public.course_enrollments
  FOR SELECT USING (student_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
