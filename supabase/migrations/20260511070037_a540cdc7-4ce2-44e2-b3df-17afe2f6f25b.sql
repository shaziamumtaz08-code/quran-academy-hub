-- Security-definer dashboard context RPC. Returns teacher list and current live session info
-- for a given student, callable by the student, their linked parent, an assigned teacher, or any admin.
CREATE OR REPLACE FUNCTION public.get_student_dashboard_context(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean := false;
  _teachers jsonb;
  _live jsonb;
BEGIN
  IF _student_id IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() = _student_id
     OR public.is_admin(auth.uid())
     OR public.is_super_admin(auth.uid())
     OR EXISTS (SELECT 1 FROM public.student_parent_links spl
                WHERE spl.student_id = _student_id AND spl.parent_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.student_teacher_assignments sta
                WHERE sta.student_id = _student_id AND sta.teacher_id = auth.uid())
  THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'assignment_id', sta.id,
    'teacher_id', sta.teacher_id,
    'teacher_name', p.full_name,
    'subject_name', s.name
  )), '[]'::jsonb)
  INTO _teachers
  FROM public.student_teacher_assignments sta
  LEFT JOIN public.profiles p ON p.id = sta.teacher_id
  LEFT JOIN public.subjects s ON s.id = sta.subject_id
  WHERE sta.student_id = _student_id AND sta.status = 'active';

  SELECT jsonb_build_object(
    'session_id', ls.id,
    'meeting_link', zl.meeting_link,
    'teacher_id', ls.teacher_id
  )
  INTO _live
  FROM public.live_sessions ls
  LEFT JOIN public.zoom_licenses zl ON zl.id = ls.license_id
  WHERE ls.status = 'live'
    AND ls.teacher_id IN (
      SELECT teacher_id FROM public.student_teacher_assignments
      WHERE student_id = _student_id AND status = 'active'
    )
  ORDER BY ls.actual_start DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'teachers', _teachers,
    'live_session', _live
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_dashboard_context(uuid) TO authenticated;