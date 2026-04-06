-- Create session_recordings table
CREATE TABLE public.session_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  recording_type TEXT NOT NULL DEFAULT 'shared_screen_with_speaker_view',
  play_url TEXT,
  download_url TEXT,
  password TEXT,
  file_size_mb NUMERIC,
  file_type TEXT DEFAULT 'MP4',
  recording_start TIMESTAMPTZ,
  recording_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to recordings"
ON public.session_recordings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Teachers can view their own session recordings
CREATE POLICY "Teachers view own session recordings"
ON public.session_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = session_recordings.session_id
    AND ls.teacher_id = auth.uid()
  )
);

-- Students can view recordings via teacher assignment
CREATE POLICY "Students view recordings via assignment"
ON public.session_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.student_teacher_assignments sta ON sta.teacher_id = ls.teacher_id
    WHERE ls.id = session_recordings.session_id
    AND sta.student_id = auth.uid()
    AND sta.status IN ('active', 'completed')
  )
);

-- Parents can view via children
CREATE POLICY "Parents view recordings via children"
ON public.session_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.student_teacher_assignments sta ON sta.teacher_id = ls.teacher_id
    JOIN public.student_parent_links spl ON spl.student_id = sta.student_id
    WHERE ls.id = session_recordings.session_id
    AND spl.parent_id = auth.uid()
  )
);

-- Add recording_status and recording_fetched_at to live_sessions
ALTER TABLE public.live_sessions 
  ADD COLUMN IF NOT EXISTS recording_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recording_fetched_at TIMESTAMPTZ;

-- Index for faster lookups
CREATE INDEX idx_session_recordings_session_id ON public.session_recordings(session_id);