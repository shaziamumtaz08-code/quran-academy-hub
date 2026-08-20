
CREATE OR REPLACE FUNCTION public.is_quiz_bank_owner(_user_id uuid, _quiz_bank_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.quiz_banks qb WHERE qb.id = _quiz_bank_id AND qb.created_by = _user_id);
$$;

DROP POLICY IF EXISTS quiz_collab_select ON public.quiz_collaborators;
CREATE POLICY quiz_collab_select ON public.quiz_collaborators
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR invited_by = auth.uid()
  OR public.is_quiz_bank_owner(auth.uid(), quiz_bank_id)
  OR public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Students view live sessions" ON public.quiz_sessions;
CREATE POLICY "Students view live sessions" ON public.quiz_sessions
FOR SELECT TO authenticated
USING (
  status = 'live'
  AND (opens_at IS NULL OR opens_at <= now())
  AND (closes_at IS NULL OR closes_at >= now())
  AND EXISTS (
    SELECT 1 FROM public.quiz_banks qb
    WHERE qb.id = quiz_sessions.quiz_bank_id
      AND qb.mode = 'authenticated'
      AND public.is_enrolled_in_course(auth.uid(), qb.course_id)
      AND (
        qb.assignment_id IS NULL
        OR qb.assignment_id IN (SELECT public.get_student_active_assignment_ids(auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS super_admin_can_update_route_hits ON public.route_hits;
CREATE POLICY super_admin_can_update_route_hits ON public.route_hits
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS super_admin_can_delete_route_hits ON public.route_hits;
CREATE POLICY super_admin_can_delete_route_hits ON public.route_hits
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));
