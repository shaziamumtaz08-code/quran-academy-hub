-- Tighten profile visibility while allowing student->assigned-teacher lookup
-- NOTE: roles remain in public.user_roles (no roles stored on profiles).

-- Remove overly-permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Super admins can manage all profiles
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- Teachers can view assigned students' profiles
DROP POLICY IF EXISTS "Teachers can view assigned students profiles" ON public.profiles;
CREATE POLICY "Teachers can view assigned students profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND id IN (SELECT get_teacher_student_ids(auth.uid()))
);

-- Students can view their assigned teacher's profile (name/email) via enrollments
DROP POLICY IF EXISTS "Students can view assigned teachers profiles" ON public.profiles;
CREATE POLICY "Students can view assigned teachers profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (
    SELECT e.teacher_id
    FROM public.enrollments e
    WHERE e.student_id = auth.uid()
      AND e.status = 'active'
  )
);

-- Parents can view their children profiles
DROP POLICY IF EXISTS "Parents can view children profiles" ON public.profiles;
CREATE POLICY "Parents can view children profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND id IN (SELECT get_parent_children_ids(auth.uid()))
);

-- Examiners (staff) can view profiles needed for exam screens
DROP POLICY IF EXISTS "Examiners can view profiles" ON public.profiles;
CREATE POLICY "Examiners can view profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'examiner'::app_role));
