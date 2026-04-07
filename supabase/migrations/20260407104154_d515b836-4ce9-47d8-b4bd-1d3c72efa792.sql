-- Add participant raw data columns to zoom_attendance_logs
ALTER TABLE public.zoom_attendance_logs 
  ADD COLUMN IF NOT EXISTS participant_name text,
  ADD COLUMN IF NOT EXISTS participant_email text,
  ADD COLUMN IF NOT EXISTS role text;

-- Make user_id nullable so we can log even without a match
ALTER TABLE public.zoom_attendance_logs 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add student_id to live_sessions
ALTER TABLE public.live_sessions 
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id);