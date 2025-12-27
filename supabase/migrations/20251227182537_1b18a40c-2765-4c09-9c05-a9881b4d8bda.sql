-- Add missing fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female')),
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'english';

-- Create enrollments table linking students to teachers and subjects
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, teacher_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin can manage all enrollments"
  ON public.enrollments FOR ALL
  USING (is_super_admin(auth.uid()));

-- Admin can do everything  
CREATE POLICY "Admin can manage all enrollments"
  ON public.enrollments FOR ALL
  USING (is_admin(auth.uid()));

-- Teachers can view their enrollments
CREATE POLICY "Teachers can view their enrollments"
  ON public.enrollments FOR SELECT
  USING (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Parents can view their children's enrollments  
CREATE POLICY "Parents can view children enrollments"
  ON public.enrollments FOR SELECT
  USING (has_role(auth.uid(), 'parent') AND student_id IN (SELECT get_parent_children_ids(auth.uid())));

-- Create trigger for updated_at
CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add sabaq and revision fields to attendance for lesson tracking
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS sabaq text,
ADD COLUMN IF NOT EXISTS revision_done boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revision_notes text,
ADD COLUMN IF NOT EXISTS progress_marker text;