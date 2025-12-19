-- =============================================
-- EXAM SYSTEM DATABASE SCHEMA
-- =============================================

-- 1. Create Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student', 'parent', 'examiner');
CREATE TYPE public.exam_tenure AS ENUM ('weekly', 'monthly', 'quarterly');

-- 2. User Roles Table (for RLS)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security Definer Functions (prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 4. Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Student-Teacher Assignments
CREATE TABLE public.student_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (student_id, teacher_id)
);

ALTER TABLE public.student_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- 6. Student-Parent Links
CREATE TABLE public.student_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (student_id, parent_id)
);

ALTER TABLE public.student_parent_links ENABLE ROW LEVEL SECURITY;

-- Helper function: Get teacher's assigned student IDs
CREATE OR REPLACE FUNCTION public.get_teacher_student_ids(_teacher_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM public.student_teacher_assignments WHERE teacher_id = _teacher_id
$$;

-- Helper function: Get parent's children IDs
CREATE OR REPLACE FUNCTION public.get_parent_children_ids(_parent_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM public.student_parent_links WHERE parent_id = _parent_id
$$;

-- =============================================
-- EXAM SYSTEM TABLES
-- =============================================

-- 7. Subjects Table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- 8. Exam Templates Table
CREATE TABLE public.exam_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  tenure exam_tenure NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- 9. Exam Template Fields Table
CREATE TABLE public.exam_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.exam_templates(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  max_marks INTEGER NOT NULL CHECK (max_marks >= 0),
  description TEXT,
  is_public BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.exam_template_fields ENABLE ROW LEVEL SECURITY;

-- 10. Exams Table (submissions)
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.exam_templates(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  examiner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_marks INTEGER NOT NULL DEFAULT 0,
  max_total_marks INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  examiner_remarks TEXT,
  public_remarks TEXT,
  exam_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- 11. Exam Field Results Table
CREATE TABLE public.exam_field_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.exam_template_fields(id) ON DELETE CASCADE NOT NULL,
  marks INTEGER NOT NULL CHECK (marks >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (exam_id, field_id)
);

ALTER TABLE public.exam_field_results ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- USER ROLES POLICIES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- PROFILES POLICIES
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- STUDENT-TEACHER ASSIGNMENTS POLICIES
CREATE POLICY "Admin can manage assignments" ON public.student_teacher_assignments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Teachers can view own assignments" ON public.student_teacher_assignments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- STUDENT-PARENT LINKS POLICIES
CREATE POLICY "Admin can manage parent links" ON public.student_parent_links
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Parents can view own links" ON public.student_parent_links
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- SUBJECTS POLICIES
CREATE POLICY "Anyone authenticated can view subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- EXAM TEMPLATES POLICIES (Admin only for write, hidden from students/parents)
CREATE POLICY "Admin can manage templates" ON public.exam_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view templates" ON public.exam_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'teacher') OR
    public.has_role(auth.uid(), 'examiner')
  );

-- EXAM TEMPLATE FIELDS POLICIES (hidden from students/parents except public fields)
CREATE POLICY "Admin can manage template fields" ON public.exam_template_fields
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view all template fields" ON public.exam_template_fields
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'teacher') OR
    public.has_role(auth.uid(), 'examiner')
  );

CREATE POLICY "Students see only public fields" ON public.exam_template_fields
  FOR SELECT TO authenticated
  USING (
    is_public = true AND (
      public.has_role(auth.uid(), 'student') OR
      public.has_role(auth.uid(), 'parent')
    )
  );

-- EXAMS POLICIES
CREATE POLICY "Admin can manage all exams" ON public.exams
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Examiner can insert exams" ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'examiner'));

CREATE POLICY "Examiner can view exams they created" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'examiner') AND examiner_id = auth.uid()
  );

CREATE POLICY "Teacher can view assigned student exams" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    student_id IN (SELECT public.get_teacher_student_ids(auth.uid()))
  );

CREATE POLICY "Student can view own exams" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student') AND student_id = auth.uid()
  );

CREATE POLICY "Parent can view children exams" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent') AND
    student_id IN (SELECT public.get_parent_children_ids(auth.uid()))
  );

-- EXAM FIELD RESULTS POLICIES
CREATE POLICY "Admin can manage all results" ON public.exam_field_results
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Examiner can insert results" ON public.exam_field_results
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'examiner'));

CREATE POLICY "Staff can view all results" ON public.exam_field_results
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'examiner') OR
    public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Student can view own results for public fields" ON public.exam_field_results
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student') AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.student_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.exam_template_fields f
      WHERE f.id = field_id AND f.is_public = true
    )
  );

CREATE POLICY "Parent can view children results for public fields" ON public.exam_field_results
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent') AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.student_id IN (SELECT public.get_parent_children_ids(auth.uid()))
    ) AND
    EXISTS (
      SELECT 1 FROM public.exam_template_fields f
      WHERE f.id = field_id AND f.is_public = true
    )
  );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_exams_student_id ON public.exams(student_id);
CREATE INDEX idx_exams_template_id ON public.exams(template_id);
CREATE INDEX idx_exams_examiner_id ON public.exams(examiner_id);
CREATE INDEX idx_exams_exam_date ON public.exams(exam_date);
CREATE INDEX idx_exam_field_results_exam_id ON public.exam_field_results(exam_id);
CREATE INDEX idx_exam_template_fields_template_id ON public.exam_template_fields(template_id);
CREATE INDEX idx_student_teacher_assignments_teacher ON public.student_teacher_assignments(teacher_id);
CREATE INDEX idx_student_parent_links_parent ON public.student_parent_links(parent_id);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exam_templates_updated_at
  BEFORE UPDATE ON public.exam_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DEFAULT SUBJECTS
-- =============================================
INSERT INTO public.subjects (name, description) VALUES
  ('Mathematics', 'Core mathematics curriculum'),
  ('English', 'English language and literature'),
  ('Science', 'General science studies'),
  ('History', 'World and local history'),
  ('Geography', 'Physical and human geography');