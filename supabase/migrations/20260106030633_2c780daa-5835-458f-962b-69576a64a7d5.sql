-- Add time tracking columns to zoom_attendance_logs
ALTER TABLE public.zoom_attendance_logs 
ADD COLUMN IF NOT EXISTS join_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS leave_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_duration_minutes integer;

-- Add media fields to live_sessions
ALTER TABLE public.live_sessions 
ADD COLUMN IF NOT EXISTS recording_link text,
ADD COLUMN IF NOT EXISTS stream_url text;

-- Create function to calculate late entry and short session status
CREATE OR REPLACE FUNCTION public.calculate_attendance_metrics(
  _join_time timestamp with time zone,
  _leave_time timestamp with time zone,
  _session_start timestamp with time zone,
  _scheduled_duration integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  late_by_minutes integer;
  session_duration_minutes integer;
  left_early_minutes integer;
  is_late boolean := false;
  is_short boolean := false;
BEGIN
  -- Calculate late entry (if join > 10 minutes from start)
  IF _join_time IS NOT NULL AND _session_start IS NOT NULL THEN
    late_by_minutes := EXTRACT(EPOCH FROM (_join_time - _session_start)) / 60;
    IF late_by_minutes > 10 THEN
      is_late := true;
    END IF;
  END IF;
  
  -- Calculate session duration and early departure
  IF _join_time IS NOT NULL AND _leave_time IS NOT NULL THEN
    session_duration_minutes := EXTRACT(EPOCH FROM (_leave_time - _join_time)) / 60;
    left_early_minutes := _scheduled_duration - session_duration_minutes;
    IF left_early_minutes > 5 THEN
      is_short := true;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'late_by_minutes', GREATEST(0, late_by_minutes),
    'is_late', is_late,
    'session_duration_minutes', COALESCE(session_duration_minutes, 0),
    'left_early_minutes', GREATEST(0, left_early_minutes),
    'is_short', is_short
  );
END;
$$;

-- Create trigger to auto-set join_time on insert
CREATE OR REPLACE FUNCTION public.set_attendance_join_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action = 'join_intent' AND NEW.join_time IS NULL THEN
    NEW.join_time := COALESCE(NEW.timestamp, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_attendance_join_time_trigger ON public.zoom_attendance_logs;
CREATE TRIGGER set_attendance_join_time_trigger
BEFORE INSERT ON public.zoom_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_attendance_join_time();

-- Create trigger to update leave_time and calculate duration on leave action
CREATE OR REPLACE FUNCTION public.update_attendance_leave_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action = 'leave' THEN
    NEW.leave_time := COALESCE(NEW.timestamp, now());
    
    -- Find the corresponding join record and update duration
    IF NEW.join_time IS NOT NULL THEN
      NEW.total_duration_minutes := EXTRACT(EPOCH FROM (NEW.leave_time - NEW.join_time)) / 60;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_attendance_leave_time_trigger ON public.zoom_attendance_logs;
CREATE TRIGGER update_attendance_leave_time_trigger
BEFORE INSERT ON public.zoom_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_attendance_leave_time();