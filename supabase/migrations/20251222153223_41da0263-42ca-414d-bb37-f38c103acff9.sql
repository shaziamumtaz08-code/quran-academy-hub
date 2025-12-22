-- Add policy for super admins to manage all assignments
CREATE POLICY "Super admin can manage assignments"
  ON public.student_teacher_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));