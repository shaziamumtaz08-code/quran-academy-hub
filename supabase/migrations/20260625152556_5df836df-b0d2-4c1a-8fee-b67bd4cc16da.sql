CREATE OR REPLACE FUNCTION public.get_student_dashboard_context(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  WITH ranked_assignments AS (
    SELECT sta.*,
           row_number() OVER (
             PARTITION BY sta.teacher_id
             ORDER BY
               CASE
                 WHEN sta.status = 'active' THEN 0
                 WHEN sta.status = 'on_hold' THEN 1
                 ELSE 2
               END,
               COALESCE(sta.effective_from_date, sta.start_date, sta.created_at::date) DESC,
               sta.created_at DESC
           ) AS rn
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = _student_id
      AND sta.status IN ('active', 'on_hold')
      AND COALESCE(sta.effective_from_date, sta.start_date, sta.created_at::date) <= CURRENT_DATE
      AND COALESCE(sta.effective_to_date, sta.substitute_end_date, sta.temp_end_date, DATE '2999-12-31') >= CURRENT_DATE
  ), fallback_assignment AS (
    SELECT sta.*
    FROM public.student_teacher_assignments sta
    WHERE sta.student_id = _student_id
      AND sta.status IN ('active', 'on_hold')
    ORDER BY
      CASE WHEN sta.status = 'active' THEN 0 ELSE 1 END,
      COALESCE(sta.effective_from_date, sta.start_date, sta.created_at::date) DESC,
      sta.created_at DESC
    LIMIT 1
  ), chosen AS (
    SELECT * FROM ranked_assignments WHERE rn = 1
    UNION ALL
    SELECT fa.* FROM fallback_assignment fa
    WHERE NOT EXISTS (SELECT 1 FROM ranked_assignments)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'assignment_id', c.id,
    'teacher_id', c.teacher_id,
    'teacher_name', p.full_name,
    'subject_name', s.name,
    'status', c.status
  ) ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, COALESCE(c.effective_from_date, c.start_date, c.created_at::date) DESC), '[]'::jsonb)
  INTO _teachers
  FROM chosen c
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  LEFT JOIN public.subjects s ON s.id = c.subject_id;

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
      SELECT (x->>'teacher_id')::uuid
      FROM jsonb_array_elements(_teachers) x
      WHERE x ? 'teacher_id' AND x->>'teacher_id' IS NOT NULL
    )
  ORDER BY ls.actual_start DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'teachers', COALESCE(_teachers, '[]'::jsonb),
    'live_session', _live
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_or_create_assignment_dm(
  _student_id uuid,
  _teacher_id uuid,
  _student_name text DEFAULT 'Student',
  _teacher_name text DEFAULT 'Teacher'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _allowed boolean := false;
  _group_id uuid;
BEGIN
  IF _actor IS NULL OR _student_id IS NULL OR _teacher_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _actor = _student_id
     OR _actor = _teacher_id
     OR public.is_admin(_actor)
     OR public.is_super_admin(_actor)
     OR EXISTS (SELECT 1 FROM public.student_parent_links spl WHERE spl.student_id = _student_id AND spl.parent_id = _actor)
  THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN
    RETURN NULL;
  END IF;

  SELECT cg.id INTO _group_id
  FROM public.chat_groups cg
  WHERE cg.is_dm = true
    AND cg.course_id IS NULL
    AND EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.group_id = cg.id AND cm.user_id = _student_id)
    AND EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.group_id = cg.id AND cm.user_id = _teacher_id)
  ORDER BY cg.created_at DESC
  LIMIT 1;

  IF _group_id IS NULL THEN
    INSERT INTO public.chat_groups (name, type, created_by, is_dm, is_active, channel_mode)
    VALUES (COALESCE(NULLIF(_student_name, ''), 'Student') || ' ↔ ' || COALESCE(NULLIF(_teacher_name, ''), 'Teacher'), 'assignment_dm', _actor, true, true, 'private')
    RETURNING id INTO _group_id;
  END IF;

  INSERT INTO public.chat_members (group_id, user_id, role)
  SELECT _group_id, v.user_id, 'member'
  FROM (SELECT DISTINCT unnest(ARRAY[_student_id, _teacher_id, _actor]) AS user_id) v
  WHERE v.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN _group_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_student_dashboard_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_assignment_dm(uuid, uuid, text, text) TO authenticated;