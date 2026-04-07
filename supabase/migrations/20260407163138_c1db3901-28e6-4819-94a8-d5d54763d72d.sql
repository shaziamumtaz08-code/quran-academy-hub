
-- Registration forms (one per course)
CREATE TABLE public.registration_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Course Registration',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.registration_forms ENABLE ROW LEVEL SECURITY;

-- Public can read active forms
CREATE POLICY "Anyone can view active registration forms"
  ON public.registration_forms FOR SELECT
  USING (is_active = true);

-- Admins can manage forms
CREATE POLICY "Admins can manage registration forms"
  ON public.registration_forms FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Registration form fields
CREATE TABLE public.registration_form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.registration_forms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB DEFAULT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_form_fields ENABLE ROW LEVEL SECURITY;

-- Public can read fields for active forms
CREATE POLICY "Anyone can view form fields"
  ON public.registration_form_fields FOR SELECT
  USING (true);

-- Admins can manage fields
CREATE POLICY "Admins can manage form fields"
  ON public.registration_form_fields FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Registration submissions
CREATE TABLE public.registration_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.registration_forms(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  source_tag TEXT DEFAULT 'website',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID DEFAULT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public form)
CREATE POLICY "Anyone can submit registration"
  ON public.registration_submissions FOR INSERT
  WITH CHECK (true);

-- Admins can view and manage submissions
CREATE POLICY "Admins can manage submissions"
  ON public.registration_submissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_registration_forms_updated_at
  BEFORE UPDATE ON public.registration_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
