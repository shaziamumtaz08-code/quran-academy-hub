CREATE OR REPLACE FUNCTION public.notify_assignment_event(_submission_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  a record;
  student_name text;
  teacher_ids uuid[];
BEGIN
  SELECT * INTO s FROM public.course_assignment_submissions WHERE id = _submission_id;
  IF s IS NULL THEN RETURN; END IF;

  SELECT * INTO a FROM public.course_assignments WHERE id = s.assignment_id;
  SELECT full_name INTO student_name FROM public.profiles WHERE id = s.student_id;

  IF _kind = 'submitted' THEN
    -- only the student who owns the submission may raise this
    IF auth.uid() IS DISTINCT FROM s.student_id THEN RETURN; END IF;

    SELECT array_agg(DISTINCT uid) INTO teacher_ids FROM (
      SELECT a.created_by AS uid WHERE a.created_by IS NOT NULL
      UNION
      SELECT cs.user_id FROM public.course_class_staff cs
      JOIN public.course_classes cc ON cc.id = cs.class_id
      WHERE cc.course_id = a.course_id AND cs.user_id IS NOT NULL
    ) q;

    IF teacher_ids IS NOT NULL THEN
      INSERT INTO public.notification_queue (recipient_id, recipient_type, notification_type, title, message, metadata, status)
      SELECT t, 'teacher', 'assignment_submission', 'New assignment submission',
             coalesce(student_name, 'A student') || ' submitted a synced copy for "' || coalesce(a.title, 'an assignment') || '".',
             jsonb_build_object('assignment_id', s.assignment_id, 'submission_id', s.id, 'student_id', s.student_id, 'mode', 'synced'),
             'pending'
      FROM unnest(teacher_ids) AS t;
    END IF;

  ELSIF _kind = 'reviewed' THEN
    IF NOT (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
      RETURN;
    END IF;
    INSERT INTO public.notification_queue (recipient_id, recipient_type, notification_type, title, message, metadata, status)
    VALUES (s.student_id, 'student', 'assignment_reviewed', 'Your work has been checked',
            'Your teacher returned the checked copy of your assignment.',
            jsonb_build_object('assignment_id', s.assignment_id, 'submission_id', s.id), 'pending');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_assignment_event(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_assignment_event(uuid, text) TO authenticated;