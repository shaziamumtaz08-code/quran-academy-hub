
-- Create leads table for the inquiry-to-enrollment pipeline
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  phone_whatsapp TEXT,
  country TEXT,
  city TEXT,
  for_whom TEXT NOT NULL DEFAULT 'self' CHECK (for_whom IN ('self', 'child', 'other')),
  child_name TEXT,
  child_age INTEGER,
  child_gender TEXT,
  subject_interest TEXT,
  preferred_time TEXT,
  message TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'demo_scheduled', 'demo_done',
    'feedback_pending', 'ready_to_enroll',
    'enrollment_form_sent', 'form_submitted',
    'enrolled', 'lost'
  )),
  match_status TEXT DEFAULT 'new_contact' CHECK (match_status IN ('new_contact', 'matched_existing', 'matched_parent')),
  matched_person_id UUID REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  notes JSONB DEFAULT '[]'::jsonb,
  lost_reason TEXT,
  enrollment_form_token TEXT UNIQUE,
  enrollment_form_sent_at TIMESTAMPTZ,
  enrollment_form_opened_at TIMESTAMPTZ,
  enrollment_form_data JSONB,
  converted_person_ids UUID[],
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create demo_sessions table
CREATE TABLE public.demo_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id),
  teacher_id UUID REFERENCES public.profiles(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  platform TEXT DEFAULT 'zoom' CHECK (platform IN ('zoom', 'google_meet', 'virtual_classroom', 'other')),
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled')),
  teacher_notes TEXT,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_response TEXT CHECK (feedback_response IN ('yes', 'thinking', 'no')),
  feedback_comment TEXT,
  feedback_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
CREATE POLICY "Admins can manage all leads"
ON public.leads FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin_admissions'::app_role))
WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin_admissions'::app_role));

CREATE POLICY "Anonymous can create leads"
ON public.leads FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Teachers can view assigned leads"
ON public.leads FOR SELECT
USING (has_role(auth.uid(), 'teacher'::app_role) AND assigned_to = auth.uid());

-- RLS policies for demo_sessions
CREATE POLICY "Admins can manage all demo sessions"
ON public.demo_sessions FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin_admissions'::app_role))
WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin_admissions'::app_role));

CREATE POLICY "Teachers can view their demo sessions"
ON public.demo_sessions FOR SELECT
USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

CREATE POLICY "Teachers can update their demo sessions"
ON public.demo_sessions FOR UPDATE
USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

-- Indexes
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_org_id ON public.leads(org_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_enrollment_token ON public.leads(enrollment_form_token);
CREATE INDEX idx_demo_sessions_lead_id ON public.demo_sessions(lead_id);
CREATE INDEX idx_demo_sessions_teacher_id ON public.demo_sessions(teacher_id);
CREATE INDEX idx_demo_sessions_scheduled_date ON public.demo_sessions(scheduled_date);

-- Updated_at triggers
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_demo_sessions_updated_at
BEFORE UPDATE ON public.demo_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
