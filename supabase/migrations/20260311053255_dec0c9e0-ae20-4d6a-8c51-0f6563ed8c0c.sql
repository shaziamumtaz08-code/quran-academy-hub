-- Allow students to view their own assignments
CREATE POLICY "Students can view own assignments"
ON public.student_teacher_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid()
);

-- Allow parents to view their children's assignments
CREATE POLICY "Parents can view children assignments"
ON public.student_teacher_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role) 
  AND student_id IN (SELECT get_parent_children_ids(auth.uid()))
);