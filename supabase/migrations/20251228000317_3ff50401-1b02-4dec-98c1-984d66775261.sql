-- Drop existing RESTRICTIVE policies on attendance table
DROP POLICY IF EXISTS "Admin can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view children attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Super admin can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can update their attendance records" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can view their attendance records" ON public.attendance;

-- Recreate as PERMISSIVE policies (default behavior - any matching policy grants access)
CREATE POLICY "Super admin can manage all attendance" ON public.attendance
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage all attendance" ON public.attendance
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Teachers can view their attendance records" ON public.attendance
  FOR SELECT USING (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Teachers can insert attendance" ON public.attendance
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid() AND student_id IN (SELECT get_teacher_student_ids(auth.uid())));

CREATE POLICY "Teachers can update their attendance records" ON public.attendance
  FOR UPDATE USING (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT USING (has_role(auth.uid(), 'student') AND student_id = auth.uid());

CREATE POLICY "Parents can view children attendance" ON public.attendance
  FOR SELECT USING (has_role(auth.uid(), 'parent') AND student_id IN (SELECT get_parent_children_ids(auth.uid())));

-- Drop existing RESTRICTIVE policies on exams table
DROP POLICY IF EXISTS "Admin can manage all exams" ON public.exams;
DROP POLICY IF EXISTS "Examiner can insert exams" ON public.exams;
DROP POLICY IF EXISTS "Examiner can view exams they created" ON public.exams;
DROP POLICY IF EXISTS "Parent can view children exams" ON public.exams;
DROP POLICY IF EXISTS "Student can view own exams" ON public.exams;
DROP POLICY IF EXISTS "Teacher can view assigned student exams" ON public.exams;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admin can manage all exams" ON public.exams
  FOR ALL USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Examiner can insert exams" ON public.exams
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'examiner'));

CREATE POLICY "Examiner can view exams they created" ON public.exams
  FOR SELECT USING (has_role(auth.uid(), 'examiner') AND examiner_id = auth.uid());

CREATE POLICY "Teacher can view assigned student exams" ON public.exams
  FOR SELECT USING (has_role(auth.uid(), 'teacher') AND student_id IN (SELECT get_teacher_student_ids(auth.uid())));

CREATE POLICY "Student can view own exams" ON public.exams
  FOR SELECT USING (has_role(auth.uid(), 'student') AND student_id = auth.uid());

CREATE POLICY "Parent can view children exams" ON public.exams
  FOR SELECT USING (has_role(auth.uid(), 'parent') AND student_id IN (SELECT get_parent_children_ids(auth.uid())));