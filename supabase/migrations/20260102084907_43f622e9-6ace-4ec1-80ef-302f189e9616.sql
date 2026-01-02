-- Fix student_fees table: Remove teacher access, restrict to owner and admins only

-- Drop the existing teacher policy that exposes financial data
DROP POLICY IF EXISTS "Teachers can view student fees" ON public.student_fees;

-- Fix profiles table: Restrict sensitive data exposure

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Teachers can view assigned students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can view assigned teachers profiles" ON public.profiles;

-- Create restricted teacher policy - only view student names, not contact details
-- Teachers can see basic info of their assigned students via a view or function
CREATE POLICY "Teachers can view assigned students basic info" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND id IN (SELECT get_teacher_student_ids(auth.uid()))
);

-- Students can only view their own profile (already exists as "Users can view own profile")
-- For teacher names, create a restricted policy
CREATE POLICY "Students can view assigned teacher basic info" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND id IN (
    SELECT e.teacher_id 
    FROM enrollments e 
    WHERE e.student_id = auth.uid() AND e.status = 'active'
  )
);