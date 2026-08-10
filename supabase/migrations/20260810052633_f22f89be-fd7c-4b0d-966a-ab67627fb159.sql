DO $$
DECLARE
  v_student uuid := 'de73e8e2-1932-4dba-9a27-e8e389fe0400';
  v_teacher uuid := 'ed8631f7-c179-4d77-82e2-311a72219d0b';
  v_div uuid := '00000000-0000-0000-0000-000000000003';
  d date;
  i int := 0;
  ayah int := 1;
  v_status text;
BEGIN
  FOR d IN
    SELECT gs::date FROM generate_series((current_date - interval '26 days')::date, (current_date - interval '1 day')::date, interval '1 day') gs
  LOOP
    IF EXTRACT(dow FROM d) = 0 THEN CONTINUE; END IF;
    i := i + 1;
    v_status := CASE WHEN i % 11 = 0 THEN 'student_absent'
                     WHEN i % 13 = 0 THEN 'teacher_leave'
                     ELSE 'present' END;
    IF EXISTS (SELECT 1 FROM public.attendance WHERE student_id = v_student AND class_date = d) THEN CONTINUE; END IF;
    INSERT INTO public.attendance (
      student_id, teacher_id, class_date, class_time, duration_minutes, status,
      division_id, lesson_type, progress_marker, input_unit,
      sabaq_marker_type, sabaq_surah_from, sabaq_ayah_from, sabaq_surah_to, sabaq_ayah_to,
      surah_name, ayah_from, ayah_to, lesson_covered, lesson_notes, created_by, updated_by
    ) VALUES (
      v_student, v_teacher, d, '17:00', 30, v_status,
      v_div, 'nazra', 'ayahs', 'ayahs',
      'ayah', 'Al-Baqarah', ayah, 'Al-Baqarah', ayah + 7,
      'Al-Baqarah', ayah, ayah + 7,
      CASE WHEN v_status = 'present' THEN 'Nazra — Surah Al-Baqarah, Ayah ' || ayah || ' to ' || (ayah + 7) ELSE NULL END,
      CASE WHEN v_status = 'present' THEN 'Fluent recitation; revise madd rules before next class.' ELSE NULL END,
      v_teacher, v_teacher
    );
    IF v_status = 'present' THEN ayah := ayah + 8; END IF;
  END LOOP;
END $$;