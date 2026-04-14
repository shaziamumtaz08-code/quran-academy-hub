
-- 1. Add enrollment_ref to student_teacher_assignments
ALTER TABLE public.student_teacher_assignments
  ADD COLUMN IF NOT EXISTS enrollment_ref TEXT;

-- 2. Add enrollment_ref to course_class_students
ALTER TABLE public.course_class_students
  ADD COLUMN IF NOT EXISTS enrollment_ref TEXT;

-- 3. Sequence table for enrollment_ref numbering per student
CREATE TABLE IF NOT EXISTS public.enrollment_ref_sequences (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  next_val INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (profile_id)
);

ALTER TABLE public.enrollment_ref_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins manage enrollment_ref_sequences"
  ON public.enrollment_ref_sequences FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 4. Function: auto-generate URN when student role inserted
CREATE OR REPLACE FUNCTION public.fn_auto_generate_urn_on_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_urn BOOLEAN;
  _org_code TEXT := 'AQT';
  _branch_code TEXT := 'ONL';
  _role_code TEXT;
  _reg_id TEXT;
BEGIN
  -- Only act on student/teacher/parent roles
  _role_code := CASE NEW.role::text
    WHEN 'student' THEN 'STU'
    WHEN 'teacher' THEN 'TCH'
    WHEN 'parent' THEN 'PAR'
    WHEN 'admin' THEN 'ADM'
    WHEN 'super_admin' THEN 'SAD'
    WHEN 'examiner' THEN 'EXM'
    ELSE 'USR'
  END;

  -- Check if profile already has a registration_id
  SELECT (registration_id IS NOT NULL AND registration_id <> '') INTO _has_urn
  FROM public.profiles WHERE id = NEW.user_id;

  IF NOT _has_urn THEN
    -- Try to get branch code from user_context
    SELECT b.code INTO _branch_code
    FROM public.user_context uc
    JOIN public.branches b ON b.id = uc.branch_id
    WHERE uc.user_id = NEW.user_id AND uc.is_default = true
    LIMIT 1;
    
    _branch_code := COALESCE(_branch_code, 'ONL');

    _reg_id := public.generate_registration_id(_org_code, _branch_code, _role_code);
    
    UPDATE public.profiles SET registration_id = _reg_id WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_urn_on_role ON public.user_roles;
CREATE TRIGGER trg_auto_generate_urn_on_role
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_generate_urn_on_role();

-- 5. Function: auto-generate enrollment_ref for student_teacher_assignments
CREATE OR REPLACE FUNCTION public.fn_generate_enrollment_ref_sta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _urn TEXT;
  _next INTEGER;
BEGIN
  -- Get student URN
  SELECT registration_id INTO _urn FROM public.profiles WHERE id = NEW.student_id;
  
  IF _urn IS NULL OR _urn = '' THEN
    _urn := 'TEMP-' || LEFT(NEW.student_id::text, 8);
  END IF;

  -- Atomic increment
  INSERT INTO public.enrollment_ref_sequences (profile_id, next_val)
  VALUES (NEW.student_id, 1)
  ON CONFLICT (profile_id)
  DO UPDATE SET next_val = enrollment_ref_sequences.next_val + 1
  RETURNING next_val INTO _next;

  NEW.enrollment_ref := _urn || '-M-' || lpad(_next::text, 3, '0');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_enrollment_ref_sta ON public.student_teacher_assignments;
CREATE TRIGGER trg_generate_enrollment_ref_sta
  BEFORE INSERT ON public.student_teacher_assignments
  FOR EACH ROW
  WHEN (NEW.enrollment_ref IS NULL)
  EXECUTE FUNCTION public.fn_generate_enrollment_ref_sta();

-- 6. Function: auto-generate enrollment_ref for course_class_students
CREATE OR REPLACE FUNCTION public.fn_generate_enrollment_ref_ccs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _urn TEXT;
  _next INTEGER;
BEGIN
  SELECT registration_id INTO _urn FROM public.profiles WHERE id = NEW.student_id;
  
  IF _urn IS NULL OR _urn = '' THEN
    _urn := 'TEMP-' || LEFT(NEW.student_id::text, 8);
  END IF;

  INSERT INTO public.enrollment_ref_sequences (profile_id, next_val)
  VALUES (NEW.student_id, 1)
  ON CONFLICT (profile_id)
  DO UPDATE SET next_val = enrollment_ref_sequences.next_val + 1
  RETURNING next_val INTO _next;

  NEW.enrollment_ref := _urn || '-G-' || lpad(_next::text, 3, '0');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_enrollment_ref_ccs ON public.course_class_students;
CREATE TRIGGER trg_generate_enrollment_ref_ccs
  BEFORE INSERT ON public.course_class_students
  FOR EACH ROW
  WHEN (NEW.enrollment_ref IS NULL)
  EXECUTE FUNCTION public.fn_generate_enrollment_ref_ccs();
