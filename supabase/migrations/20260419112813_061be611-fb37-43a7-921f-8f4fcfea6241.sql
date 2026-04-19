-- Lock down at_risk_flags
DROP POLICY IF EXISTS "Authenticated users can view at_risk_flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Authenticated users can insert at_risk_flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Authenticated users can update at_risk_flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Anyone can view at_risk_flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Anyone can insert at_risk_flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Anyone can update at_risk_flags" ON public.at_risk_flags;

ALTER TABLE public.at_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View at-risk flags - student/teacher/admin"
ON public.at_risk_flags FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
);

CREATE POLICY "Insert at-risk flags - admin/assigned teacher"
ON public.at_risk_flags FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
);

CREATE POLICY "Update at-risk flags - admin/assigned teacher"
ON public.at_risk_flags FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_id = at_risk_flags.student_id
      AND sta.teacher_id = auth.uid()
  )
);

-- Lock down lead-attachments storage bucket
DROP POLICY IF EXISTS "Anyone can read lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read lead attachments" ON storage.objects;

CREATE POLICY "Admins read lead attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);