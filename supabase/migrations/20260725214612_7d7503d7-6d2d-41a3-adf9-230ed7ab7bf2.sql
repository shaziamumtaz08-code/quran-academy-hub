CREATE POLICY "Teachers can view their assigned students profiles"
ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (id IN (SELECT public.get_teacher_student_ids(auth.uid())));

CREATE POLICY "Students can view their teachers profiles"
ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (id IN (SELECT public.get_student_teacher_ids(auth.uid())));

CREATE POLICY "Parents can view their children profiles"
ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (id IN (SELECT public.get_parent_children_ids(auth.uid())));

CREATE POLICY "Parents can view their children teachers profiles"
ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (id IN (SELECT public.get_parent_children_teacher_ids(auth.uid())));