-- Add schedule binding columns to live_sessions
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_schedule_id ON public.live_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_assignment_id ON public.live_sessions(assignment_id);