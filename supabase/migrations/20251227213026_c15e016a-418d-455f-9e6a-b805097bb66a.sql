-- Add timezone columns to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments 
ADD COLUMN IF NOT EXISTS student_timezone text DEFAULT 'America/Toronto',
ADD COLUMN IF NOT EXISTS teacher_timezone text DEFAULT 'Asia/Karachi';

-- Create schedules table for recurring class schedules
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  student_local_time time NOT NULL,
  teacher_local_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on schedules table
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedules table
CREATE POLICY "Admin can manage all schedules" 
ON public.schedules 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Super admin can manage all schedules" 
ON public.schedules 
FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view their schedules" 
ON public.schedules 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta 
    WHERE sta.id = schedules.assignment_id 
    AND sta.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view their schedules" 
ON public.schedules 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta 
    WHERE sta.id = schedules.assignment_id 
    AND sta.student_id = auth.uid()
  )
);

CREATE POLICY "Parents can view children schedules" 
ON public.schedules 
FOR SELECT 
USING (
  has_role(auth.uid(), 'parent'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta 
    WHERE sta.id = schedules.assignment_id 
    AND sta.student_id IN (SELECT get_parent_children_ids(auth.uid()))
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_schedules_assignment_id ON public.schedules(assignment_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day_of_week ON public.schedules(day_of_week);