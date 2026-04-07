
-- Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS current_level_specimen text,
  ADD COLUMN IF NOT EXISTS learning_goals text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text;

-- Add teacher_note to demo_sessions
ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS teacher_note text;

-- Create lead_screenings table
CREATE TABLE IF NOT EXISTS public.lead_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  screened_by uuid REFERENCES public.profiles(id),
  screened_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp',
  duration_minutes integer,
  material_tested text,
  estimated_level text,
  quick_tags text[] DEFAULT '{}',
  observations text,
  confidence_rating integer,
  proceed_decision text,
  suggested_teacher_id uuid REFERENCES public.profiles(id),
  is_skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage screenings" ON public.lead_screenings
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_lead_screenings_updated_at
  BEFORE UPDATE ON public.lead_screenings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create lead_attachments table
CREATE TABLE IF NOT EXISTS public.lead_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'document',
  file_name text NOT NULL,
  file_size integer,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lead attachments" ON public.lead_attachments
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Create storage bucket for lead attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-attachments', 'lead-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read lead attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-attachments');

CREATE POLICY "Admins can upload lead attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lead-attachments');

CREATE POLICY "Admins can delete lead attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'lead-attachments');
