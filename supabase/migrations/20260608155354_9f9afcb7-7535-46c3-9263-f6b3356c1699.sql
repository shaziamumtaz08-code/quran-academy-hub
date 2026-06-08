
-- analytics_snapshots: restrict INSERT
DROP POLICY IF EXISTS "Authenticated users can insert analytics snapshots" ON public.analytics_snapshots;
CREATE POLICY "Admins or assigned teachers insert analytics snapshots"
ON public.analytics_snapshots FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_id = analytics_snapshots.student_id
      AND sta.teacher_id = auth.uid()
  )
);

-- at_risk_flags: restrict INSERT
DROP POLICY IF EXISTS "Authenticated users can insert at-risk flags" ON public.at_risk_flags;
CREATE POLICY "Admins or assigned teachers insert at-risk flags"
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

-- profiles: scope examiner SELECT to exam students only
DROP POLICY IF EXISTS "Examiners can view profiles" ON public.profiles;
CREATE POLICY "Examiners view assigned exam student profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'examiner'::app_role)
  AND id IN (SELECT student_id FROM public.exams WHERE examiner_id = auth.uid())
);

-- projects: restrict SELECT to owners and admins
DROP POLICY IF EXISTS "Users can view projects they are involved in" ON public.projects;
CREATE POLICY "Owners and admins view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- storage: lead-attachments require admin auth for write/delete
DROP POLICY IF EXISTS "Admins can upload lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lead attachments" ON storage.objects;
CREATE POLICY "Admins upload lead attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lead-attachments'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);
CREATE POLICY "Admins delete lead attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);

-- storage: registration-uploads — restrict SELECT to admins
DROP POLICY IF EXISTS "Registration uploads are publicly readable" ON storage.objects;
CREATE POLICY "Admins read registration uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'registration-uploads'
  AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
);
