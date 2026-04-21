DO $$
DECLARE
  _attached text[] := ARRAY[]::text[];
  _failed text[] := ARRAY[]::text[];
  _skipped text[] := ARRAY[]::text[];
  _updated_at_attached text[] := ARRAY[]::text[];
  _tbl text;
  _trig text;
  _evt text;
  _fn text;
  _spec text;
  _parts text[];
BEGIN
  -- ============================================================
  -- PHASE 1: Compile-test each trigger via attach + immediate detach
  -- ============================================================
  FOR _spec IN SELECT unnest(ARRAY[
    'fn_auto_generate_urn_on_role|user_roles|AFTER INSERT',
    'fn_normalize_profile_phone|profiles|BEFORE INSERT OR UPDATE',
    'auto_roster_on_enrollment|course_enrollments|AFTER INSERT OR UPDATE',
    'check_schedule_overlap|schedules|BEFORE INSERT OR UPDATE',
    'cascade_fee_package_update|fee_packages|AFTER UPDATE',
    'ensure_student_role_on_enrollment|course_class_students|AFTER INSERT',
    'fn_auto_match_submission_to_profile|registration_submissions|BEFORE INSERT',
    'fn_auto_add_staff_to_class_chats|course_class_staff|AFTER INSERT',
    'set_attendance_join_time|zoom_attendance_logs|BEFORE INSERT',
    'update_attendance_leave_time|zoom_attendance_logs|BEFORE UPDATE',
    'fn_generate_enrollment_ref_sta|student_teacher_assignments|BEFORE INSERT',
    'fn_generate_enrollment_ref_ccs|course_class_students|BEFORE INSERT'
  ])
  LOOP
    _parts := string_to_array(_spec, '|');
    _fn := _parts[1];
    _tbl := _parts[2];
    _evt := _parts[3];
    _trig := 'trg_' || _fn || '_test';

    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _trig, _tbl);
      EXECUTE format(
        'CREATE TRIGGER %I %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.%I()',
        _trig, _evt, _tbl, _fn
      );
      EXECUTE format('DROP TRIGGER %I ON public.%I', _trig, _tbl);
      _attached := _attached || (_fn || ' -> ' || _tbl || ' [compile ok]');
    EXCEPTION WHEN OTHERS THEN
      _failed := _failed || (_fn || ' -> ' || _tbl || ' :: ' || SQLERRM);
    END;
  END LOOP;

  IF array_length(_failed, 1) > 0 THEN
    RAISE EXCEPTION 'Compile test failed: %', array_to_string(_failed, ' | ');
  END IF;

  -- ============================================================
  -- PHASE 2: Real attachment (production triggers)
  -- ============================================================

  DROP TRIGGER IF EXISTS trg_auto_generate_urn_on_role ON public.user_roles;
  CREATE TRIGGER trg_auto_generate_urn_on_role
    AFTER INSERT ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_generate_urn_on_role();

  DROP TRIGGER IF EXISTS trg_normalize_profile_phone ON public.profiles;
  CREATE TRIGGER trg_normalize_profile_phone
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_profile_phone();

  DROP TRIGGER IF EXISTS trg_auto_roster_on_enrollment ON public.course_enrollments;
  CREATE TRIGGER trg_auto_roster_on_enrollment
    AFTER INSERT OR UPDATE ON public.course_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.auto_roster_on_enrollment();

  DROP TRIGGER IF EXISTS trg_check_schedule_overlap ON public.schedules;
  CREATE TRIGGER trg_check_schedule_overlap
    BEFORE INSERT OR UPDATE ON public.schedules
    FOR EACH ROW EXECUTE FUNCTION public.check_schedule_overlap();

  DROP TRIGGER IF EXISTS trg_cascade_fee_package_update ON public.fee_packages;
  CREATE TRIGGER trg_cascade_fee_package_update
    AFTER UPDATE ON public.fee_packages
    FOR EACH ROW EXECUTE FUNCTION public.cascade_fee_package_update();

  DROP TRIGGER IF EXISTS trg_ensure_student_role_on_enrollment ON public.course_class_students;
  CREATE TRIGGER trg_ensure_student_role_on_enrollment
    AFTER INSERT ON public.course_class_students
    FOR EACH ROW EXECUTE FUNCTION public.ensure_student_role_on_enrollment();

  DROP TRIGGER IF EXISTS trg_auto_match_submission_to_profile ON public.registration_submissions;
  CREATE TRIGGER trg_auto_match_submission_to_profile
    BEFORE INSERT ON public.registration_submissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_match_submission_to_profile();

  DROP TRIGGER IF EXISTS trg_auto_add_staff_to_class_chats ON public.course_class_staff;
  CREATE TRIGGER trg_auto_add_staff_to_class_chats
    AFTER INSERT ON public.course_class_staff
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_add_staff_to_class_chats();

  DROP TRIGGER IF EXISTS trg_set_attendance_join_time ON public.zoom_attendance_logs;
  CREATE TRIGGER trg_set_attendance_join_time
    BEFORE INSERT ON public.zoom_attendance_logs
    FOR EACH ROW EXECUTE FUNCTION public.set_attendance_join_time();

  DROP TRIGGER IF EXISTS trg_update_attendance_leave_time ON public.zoom_attendance_logs;
  CREATE TRIGGER trg_update_attendance_leave_time
    BEFORE UPDATE ON public.zoom_attendance_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_attendance_leave_time();

  DROP TRIGGER IF EXISTS trg_fn_generate_enrollment_ref_sta ON public.student_teacher_assignments;
  CREATE TRIGGER trg_fn_generate_enrollment_ref_sta
    BEFORE INSERT ON public.student_teacher_assignments
    FOR EACH ROW EXECUTE FUNCTION public.fn_generate_enrollment_ref_sta();

  DROP TRIGGER IF EXISTS trg_fn_generate_enrollment_ref_ccs ON public.course_class_students;
  CREATE TRIGGER trg_fn_generate_enrollment_ref_ccs
    BEFORE INSERT ON public.course_class_students
    FOR EACH ROW EXECUTE FUNCTION public.fn_generate_enrollment_ref_ccs();

  -- ============================================================
  -- PHASE 3: Auto-attach update_updated_at_column to all tables
  -- with an updated_at column, excluding system/audit tables
  -- ============================================================
  FOR _tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('schema_migrations','supabase_migrations','user_activity_log')
      AND c.table_name NOT LIKE 'auth\_%' ESCAPE '\'
      AND c.table_name NOT LIKE 'storage\_%' ESCAPE '\'
    ORDER BY c.table_name
  LOOP
    IF _tbl IN ('schema_migrations','supabase_migrations','user_activity_log')
       OR _tbl LIKE 'auth\_%' ESCAPE '\'
       OR _tbl LIKE 'storage\_%' ESCAPE '\' THEN
      _skipped := _skipped || _tbl;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', _tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        _tbl
      );
      _updated_at_attached := _updated_at_attached || _tbl;
    EXCEPTION WHEN OTHERS THEN
      _failed := _failed || ('update_updated_at_column -> ' || _tbl || ' :: ' || SQLERRM);
    END;
  END LOOP;

  RAISE NOTICE 'ATTACHED: %', array_to_string(_attached, E'\n');
  RAISE NOTICE 'UPDATED_AT ATTACHED (% tables): %', COALESCE(array_length(_updated_at_attached,1),0), array_to_string(_updated_at_attached, ', ');
  RAISE NOTICE 'SKIPPED: %', array_to_string(_skipped, ', ');
  IF array_length(_failed, 1) > 0 THEN
    RAISE EXCEPTION 'FAILED: %', array_to_string(_failed, ' | ');
  END IF;
END $$;