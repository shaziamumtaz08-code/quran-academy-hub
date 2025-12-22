-- Create enum for primary markers
DO $$ BEGIN
  CREATE TYPE primary_marker AS ENUM ('rukus', 'pages', 'lines');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for plan status
DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('pending', 'approved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create student_monthly_plans table
CREATE TABLE IF NOT EXISTS public.student_monthly_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month VARCHAR(2) NOT NULL, -- 01-12
  year VARCHAR(4) NOT NULL, -- YYYY
  primary_marker primary_marker NOT NULL DEFAULT 'lines',
  monthly_target NUMERIC NOT NULL DEFAULT 30,
  daily_target NUMERIC NOT NULL DEFAULT 1,
  status plan_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint: one plan per student per month
  UNIQUE(student_id, month, year)
);

-- Enable RLS
ALTER TABLE public.student_monthly_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin can manage all plans"
ON public.student_monthly_plans FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage all plans"
ON public.student_monthly_plans FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Teachers can view and manage their students plans"
ON public.student_monthly_plans FOR ALL
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND 
  (teacher_id = auth.uid() OR student_id IN (SELECT get_teacher_student_ids(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND 
  teacher_id = auth.uid()
);

CREATE POLICY "Students can view own plans"
ON public.student_monthly_plans FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid());

CREATE POLICY "Parents can view children plans"
ON public.student_monthly_plans FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role) AND 
  student_id IN (SELECT get_parent_children_ids(auth.uid()))
);

-- Add trigger for updated_at
CREATE TRIGGER update_student_monthly_plans_updated_at
BEFORE UPDATE ON public.student_monthly_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add progress_marker column to attendance for storing dropdown selection
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS progress_marker TEXT;

-- progress_marker will store: 'full', 'half', 'more_than_half', 'less_than_half' for rukus/pages