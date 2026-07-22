CREATE POLICY "Students view own session recordings"
ON public.session_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = session_recordings.session_id
      AND (
        ls.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.student_teacher_assignments sta
          WHERE sta.id = ls.assignment_id
            AND sta.student_id = auth.uid()
        )
      )
  )
);