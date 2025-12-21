-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_date DATE NOT NULL DEFAULT CURRENT_DATE,
  class_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  reason TEXT,
  lesson_covered TEXT,
  homework TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all attendance
CREATE POLICY "Super admin can manage all attendance"
ON public.attendance
FOR ALL
USING (is_super_admin(auth.uid()));

-- Admin can manage all attendance
CREATE POLICY "Admin can manage all attendance"
ON public.attendance
FOR ALL
USING (is_admin(auth.uid()));

-- Teachers can insert and update attendance for their assigned students
CREATE POLICY "Teachers can insert attendance"
ON public.attendance
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'teacher') AND 
  teacher_id = auth.uid() AND
  student_id IN (SELECT get_teacher_student_ids(auth.uid()))
);

CREATE POLICY "Teachers can update their attendance records"
ON public.attendance
FOR UPDATE
USING (
  has_role(auth.uid(), 'teacher') AND 
  teacher_id = auth.uid()
);

CREATE POLICY "Teachers can view their attendance records"
ON public.attendance
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher') AND 
  teacher_id = auth.uid()
);

-- Students can view their own attendance
CREATE POLICY "Students can view own attendance"
ON public.attendance
FOR SELECT
USING (
  has_role(auth.uid(), 'student') AND 
  student_id = auth.uid()
);

-- Parents can view children's attendance
CREATE POLICY "Parents can view children attendance"
ON public.attendance
FOR SELECT
USING (
  has_role(auth.uid(), 'parent') AND 
  student_id IN (SELECT get_parent_children_ids(auth.uid()))
);

-- Create updated_at trigger
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, class_date);
CREATE INDEX idx_attendance_teacher_date ON public.attendance(teacher_id, class_date);