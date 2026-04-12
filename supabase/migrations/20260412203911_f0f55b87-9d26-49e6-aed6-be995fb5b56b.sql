
-- Fix the trigger function to use correct column name
CREATE OR REPLACE FUNCTION public.auto_create_default_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.course_classes (
    course_id, name, class_type, status, max_seats, session_duration,
    schedule_days, fee_amount, fee_currency, is_volunteer
  ) VALUES (
    NEW.id,
    NEW.name,
    'regular',
    'active',
    COALESCE(NEW.max_students, 30),
    30,
    '{}',
    0,
    'USD',
    false
  );
  RETURN NEW;
END;
$$;

-- Backfill: create default class for courses with zero classes
INSERT INTO public.course_classes (course_id, name, class_type, status, max_seats, session_duration, schedule_days, fee_amount, fee_currency, is_volunteer)
SELECT c.id, c.name, 'regular', 'active', COALESCE(c.max_students, 30), 30, '{}', 0, 'USD', false
FROM public.courses c
WHERE NOT EXISTS (
  SELECT 1 FROM public.course_classes cc WHERE cc.course_id = c.id
);

-- Backfill: roster active enrolled students who have no class assignment
INSERT INTO public.course_class_students (class_id, student_id, status)
SELECT DISTINCT ON (ce.student_id, ce.course_id)
  first_class.id,
  ce.student_id,
  'active'
FROM public.course_enrollments ce
JOIN LATERAL (
  SELECT cc.id FROM public.course_classes cc
  WHERE cc.course_id = ce.course_id AND cc.status = 'active'
  ORDER BY cc.created_at ASC
  LIMIT 1
) first_class ON true
WHERE ce.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM public.course_class_students ccs
  JOIN public.course_classes cc2 ON cc2.id = ccs.class_id
  WHERE ccs.student_id = ce.student_id AND cc2.course_id = ce.course_id
);
