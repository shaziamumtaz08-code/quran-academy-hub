
-- Add course_id to attendance table for group class attendance
ALTER TABLE public.attendance 
ADD COLUMN course_id uuid NULL REFERENCES public.courses(id);

-- Create index for efficient queries
CREATE INDEX idx_attendance_course_id ON public.attendance(course_id) WHERE course_id IS NOT NULL;

-- RLS: Allow teachers to insert attendance for their courses
CREATE POLICY "Teachers can insert group attendance"
ON public.attendance
FOR INSERT
WITH CHECK (
  course_id IS NOT NULL AND
  auth.uid() = teacher_id AND
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_id 
    AND courses.teacher_id = auth.uid()
  )
);

-- RLS: Allow teachers to view group attendance for their courses
CREATE POLICY "Teachers can view group attendance"
ON public.attendance
FOR SELECT
USING (
  course_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_id 
    AND courses.teacher_id = auth.uid()
  )
);

-- RLS: Admins can manage group attendance (they already have broad policies, but adding explicit)
CREATE POLICY "Admins can manage group attendance"
ON public.attendance
FOR ALL
USING (
  course_id IS NOT NULL AND
  public.is_admin(auth.uid())
)
WITH CHECK (
  course_id IS NOT NULL AND
  public.is_admin(auth.uid())
);
