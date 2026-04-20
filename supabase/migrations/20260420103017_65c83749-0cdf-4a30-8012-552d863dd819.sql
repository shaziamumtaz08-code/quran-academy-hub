-- Backfill: any profile enrolled in a course/class should have the 'student' role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT student_id, 'student'::app_role
FROM public.course_class_students
WHERE student_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT student_id, 'student'::app_role
FROM public.course_enrollments
WHERE student_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger so future enrollments auto-grant student role
CREATE OR REPLACE FUNCTION public.ensure_student_role_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.student_id, 'student'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_student_role_class ON public.course_class_students;
CREATE TRIGGER trg_ensure_student_role_class
AFTER INSERT ON public.course_class_students
FOR EACH ROW EXECUTE FUNCTION public.ensure_student_role_on_enrollment();

DROP TRIGGER IF EXISTS trg_ensure_student_role_enrollment ON public.course_enrollments;
CREATE TRIGGER trg_ensure_student_role_enrollment
AFTER INSERT ON public.course_enrollments
FOR EACH ROW EXECUTE FUNCTION public.ensure_student_role_on_enrollment();