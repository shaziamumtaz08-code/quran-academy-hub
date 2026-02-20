
-- Drop and recreate the check_schedule_overlap function
-- Fix: Allow multiple classes on same day for different assignments (different subjects)
-- Fix: Only consider is_active = true schedules
-- Fix: Properly handle NEW.id on INSERT vs UPDATE
CREATE OR REPLACE FUNCTION public.check_schedule_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student_id_val UUID;
  has_overlap BOOLEAN;
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
  -- IMPORTANT: Only check ACTIVE schedules, and exclude the current record being updated
  -- Allow same student to have multiple classes on same day IF they don't overlap in time
  SELECT EXISTS (
    SELECT 1 
    FROM public.schedules s
    JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
    WHERE sta.student_id = student_id_val
    AND LOWER(s.day_of_week) = LOWER(NEW.day_of_week)
    AND s.is_active = true
    AND (
      -- On UPDATE, exclude the record being updated by matching its ID
      -- On INSERT, NEW.id will be the newly generated UUID, so this safely excludes nothing extra
      s.id IS DISTINCT FROM NEW.id
    )
    AND (
      -- Check time overlap using student_local_time
      (s.student_local_time, s.student_local_time + (s.duration_minutes || ' minutes')::interval)
      OVERLAPS
      (NEW.student_local_time, NEW.student_local_time + (NEW.duration_minutes || ' minutes')::interval)
    )
  ) INTO has_overlap;
  
  IF has_overlap THEN
    RAISE EXCEPTION 'Schedule conflict: This student already has a class at this time on %', NEW.day_of_week;
  END IF;
  
  RETURN NEW;
END;
$function$;
