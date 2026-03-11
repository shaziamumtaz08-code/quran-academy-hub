-- Drop the old policy that uses legacy enrollments table
DROP POLICY IF EXISTS "Students can view assigned teacher basic info" ON public.profiles;

-- Create new policy using student_teacher_assignments
CREATE POLICY "Students can view assigned teacher profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND id IN (
    SELECT sta.teacher_id 
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = auth.uid() AND sta.status = 'active'
  )
);

-- Also allow parents to view teachers of their children
DROP POLICY IF EXISTS "Parents can view children teacher profiles" ON public.profiles;
CREATE POLICY "Parents can view children teacher profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND id IN (
    SELECT sta.teacher_id
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id IN (SELECT get_parent_children_ids(auth.uid()))
      AND sta.status = 'active'
  )
);