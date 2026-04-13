
-- 1. Re-create auto_create_default_class function (verified: uses NEW.name)
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

-- Attach trigger (drop first to be safe)
DROP TRIGGER IF EXISTS auto_create_default_class ON public.courses;
CREATE TRIGGER auto_create_default_class
  AFTER INSERT ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_default_class();

-- 2. Create auto_roster_on_enrollment function
CREATE OR REPLACE FUNCTION public.auto_roster_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _class_id uuid;
BEGIN
  -- Only act when status is active
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, only act if status changed to active
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Find first active class for this course
  SELECT id INTO _class_id
  FROM public.course_classes
  WHERE course_id = NEW.course_id AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no class exists, skip silently
  IF _class_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert if not already rostered in any class of this course
  IF NOT EXISTS (
    SELECT 1 FROM public.course_class_students ccs
    JOIN public.course_classes cc ON cc.id = ccs.class_id
    WHERE ccs.student_id = NEW.student_id AND cc.course_id = NEW.course_id
  ) THEN
    INSERT INTO public.course_class_students (class_id, student_id, status)
    VALUES (_class_id, NEW.student_id, 'active');
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS auto_roster_on_enrollment ON public.course_enrollments;
CREATE TRIGGER auto_roster_on_enrollment
  AFTER INSERT OR UPDATE ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_roster_on_enrollment();

-- 3. Backfill: roster active enrolled students missing from any class
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
