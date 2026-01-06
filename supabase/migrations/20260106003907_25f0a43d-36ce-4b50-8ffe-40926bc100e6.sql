-- Create zoom_license_status enum
CREATE TYPE zoom_license_status AS ENUM ('available', 'busy');

-- Create session_status enum
CREATE TYPE session_status AS ENUM ('scheduled', 'live', 'frozen', 'completed');

-- Create attendance_action enum
CREATE TYPE attendance_action AS ENUM ('join_intent', 'leave');

-- Create zoom_licenses table
CREATE TABLE public.zoom_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zoom_email TEXT NOT NULL UNIQUE,
  status zoom_license_status NOT NULL DEFAULT 'available',
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  meeting_link TEXT NOT NULL,
  host_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live_sessions table
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID,
  teacher_id UUID NOT NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status session_status NOT NULL DEFAULT 'scheduled',
  license_id UUID REFERENCES public.zoom_licenses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create zoom_attendance_logs table (prefixed to avoid conflicts)
CREATE TABLE public.zoom_attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action attendance_action NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.zoom_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_attendance_logs ENABLE ROW LEVEL SECURITY;

-- ZOOM_LICENSES POLICIES
-- Admins can manage all licenses
CREATE POLICY "Admin can manage all zoom licenses"
ON public.zoom_licenses FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can view available licenses
CREATE POLICY "Teachers can view zoom licenses"
ON public.zoom_licenses FOR SELECT
USING (has_role(auth.uid(), 'teacher'::app_role));

-- LIVE_SESSIONS POLICIES
-- Admins can manage all sessions
CREATE POLICY "Admin can manage all live sessions"
ON public.live_sessions FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can manage their own sessions
CREATE POLICY "Teachers can manage their own sessions"
ON public.live_sessions FOR ALL
USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

-- Students can view live sessions for their assigned teachers
CREATE POLICY "Students can view live sessions"
ON public.live_sessions FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND 
  teacher_id IN (
    SELECT sta.teacher_id FROM student_teacher_assignments sta 
    WHERE sta.student_id = auth.uid() AND sta.status = 'active'
  )
);

-- Parents can view children's sessions
CREATE POLICY "Parents can view children sessions"
ON public.live_sessions FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role) AND
  teacher_id IN (
    SELECT sta.teacher_id FROM student_teacher_assignments sta 
    WHERE sta.student_id IN (SELECT get_parent_children_ids(auth.uid()))
    AND sta.status = 'active'
  )
);

-- ZOOM_ATTENDANCE_LOGS POLICIES
-- Admins can view all logs
CREATE POLICY "Admin can view all attendance logs"
ON public.zoom_attendance_logs FOR SELECT
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can view logs for their sessions
CREATE POLICY "Teachers can view logs for their sessions"
ON public.zoom_attendance_logs FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  session_id IN (SELECT id FROM live_sessions WHERE teacher_id = auth.uid())
);

-- Users can insert their own attendance logs
CREATE POLICY "Users can log their own attendance"
ON public.zoom_attendance_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can view their own logs
CREATE POLICY "Users can view own attendance logs"
ON public.zoom_attendance_logs FOR SELECT
USING (user_id = auth.uid());

-- Create updated_at triggers
CREATE TRIGGER update_zoom_licenses_updated_at
  BEFORE UPDATE ON public.zoom_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get available license (oldest first)
CREATE OR REPLACE FUNCTION public.get_and_reserve_license(_teacher_id UUID, _session_id UUID)
RETURNS TABLE(license_id UUID, meeting_link TEXT, zoom_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  selected_license RECORD;
BEGIN
  -- Select the oldest available license with row lock
  SELECT zl.id, zl.meeting_link, zl.zoom_email INTO selected_license
  FROM zoom_licenses zl
  WHERE zl.status = 'available'
  ORDER BY zl.last_used_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF selected_license IS NULL THEN
    RAISE EXCEPTION 'All Zoom rooms are currently occupied.';
  END IF;
  
  -- Update the license to busy
  UPDATE zoom_licenses
  SET status = 'busy', last_used_at = now()
  WHERE id = selected_license.id;
  
  -- Update the session with the license and set to live
  UPDATE live_sessions
  SET license_id = selected_license.id, 
      status = 'live', 
      actual_start = now()
  WHERE id = _session_id AND teacher_id = _teacher_id;
  
  RETURN QUERY SELECT selected_license.id, selected_license.meeting_link, selected_license.zoom_email;
END;
$$;

-- Create function to release license when session ends
CREATE OR REPLACE FUNCTION public.release_license(_session_id UUID, _teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _license_id UUID;
BEGIN
  -- Get the license from the session
  SELECT license_id INTO _license_id
  FROM live_sessions
  WHERE id = _session_id AND teacher_id = _teacher_id;
  
  IF _license_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Release the license
  UPDATE zoom_licenses
  SET status = 'available'
  WHERE id = _license_id;
  
  -- Update session status
  UPDATE live_sessions
  SET status = 'completed', actual_end = now()
  WHERE id = _session_id;
  
  RETURN TRUE;
END;
$$;