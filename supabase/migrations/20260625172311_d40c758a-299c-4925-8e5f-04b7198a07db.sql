
CREATE OR REPLACE FUNCTION public.get_student_teacher_ids(_student_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT teacher_id
  FROM public.student_teacher_assignments
  WHERE student_id = _student_id
    AND status IN ('active','on_hold');
$$;

CREATE POLICY "Students view assigned teacher profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (SELECT public.get_student_teacher_ids(auth.uid()))
);

CREATE OR REPLACE FUNCTION public.get_parent_children_teacher_ids(_parent_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT sta.teacher_id
  FROM public.student_teacher_assignments sta
  WHERE sta.student_id IN (SELECT public.get_parent_children_ids(_parent_id))
    AND sta.status IN ('active','on_hold');
$$;

CREATE POLICY "Parents view children assigned teacher profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND id IN (SELECT public.get_parent_children_teacher_ids(auth.uid()))
);
