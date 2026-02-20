
CREATE OR REPLACE FUNCTION public.check_schedule_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student_id_val UUID;
  has_overlap BOOLEAN;
  conflict_division_name TEXT;
BEGIN
  -- Get the student_id from the assignment
  SELECT sta.student_id INTO student_id_val
  FROM public.student_teacher_assignments sta
  WHERE sta.id = NEW.assignment_id;
  
  -- If no student found, skip validation
  IF student_id_val IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check for overlapping schedules for the same student on the same day
  -- Search across ALL divisions (not just the current one) to prevent invisible conflicts
  SELECT EXISTS (
    SELECT 1 
    FROM public.schedules s
    JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
    WHERE sta.student_id = student_id_val
    AND LOWER(s.day_of_week) = LOWER(NEW.day_of_week)
    AND s.is_active = true
    AND s.id IS DISTINCT FROM NEW.id
    AND (
      (s.student_local_time, s.student_local_time + (s.duration_minutes || ' minutes')::interval)
      OVERLAPS
      (NEW.student_local_time, NEW.student_local_time + (NEW.duration_minutes || ' minutes')::interval)
    )
  ) INTO has_overlap;
  
  IF has_overlap THEN
    -- Get the division name of the conflicting schedule for a descriptive error
    SELECT d.name INTO conflict_division_name
    FROM public.schedules s
    JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
    LEFT JOIN public.divisions d ON s.division_id = d.id
    WHERE sta.student_id = student_id_val
    AND LOWER(s.day_of_week) = LOWER(NEW.day_of_week)
    AND s.is_active = true
    AND s.id IS DISTINCT FROM NEW.id
    AND (
      (s.student_local_time, s.student_local_time + (s.duration_minutes || ' minutes')::interval)
      OVERLAPS
      (NEW.student_local_time, NEW.student_local_time + (NEW.duration_minutes || ' minutes')::interval)
    )
    LIMIT 1;
    
    IF conflict_division_name IS NOT NULL THEN
      RAISE EXCEPTION 'Conflict: This student already has an active class scheduled at this time on % in the "%" division.', NEW.day_of_week, conflict_division_name;
    ELSE
      RAISE EXCEPTION 'Schedule conflict: This student already has a class at this time on %', NEW.day_of_week;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
