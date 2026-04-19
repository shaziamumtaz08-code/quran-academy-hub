CREATE TABLE IF NOT EXISTS public.session_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  original_date date NOT NULL,
  original_time time,
  new_date date NOT NULL,
  new_time time,
  reason text,
  rescheduled_by uuid NOT NULL,
  rescheduled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_reschedules_attendance ON public.session_reschedules(attendance_id);
CREATE INDEX IF NOT EXISTS idx_session_reschedules_student ON public.session_reschedules(student_id);
CREATE INDEX IF NOT EXISTS idx_session_reschedules_teacher ON public.session_reschedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_session_reschedules_new_date ON public.session_reschedules(new_date);

ALTER TABLE public.session_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reschedule history"
  ON public.session_reschedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can log own reschedules"
  ON public.session_reschedules FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rescheduled_by
    AND (auth.uid() = teacher_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins can update reschedules"
  ON public.session_reschedules FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete reschedules"
  ON public.session_reschedules FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));