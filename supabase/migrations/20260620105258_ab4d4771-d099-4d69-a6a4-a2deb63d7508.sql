
-- 1) Storage: require auth for private buckets
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view ticket attachments" ON storage.objects;

CREATE POLICY "Authenticated users can view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view voice notes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view ticket attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);

-- 2) Storage: restrict financial receipts to admins only
DROP POLICY IF EXISTS "Authenticated users can view payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view salary receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view expense receipts" ON storage.objects;

CREATE POLICY "Admins can view financial receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('payment-receipts','salary-receipts','expense-receipts')
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

-- 3) teaching_exams: scope teacher reads to assigned courses
DROP POLICY IF EXISTS "Scoped view teaching exams" ON public.teaching_exams;

CREATE POLICY "Scoped view teaching exams"
  ON public.teaching_exams FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR created_by = auth.uid()
    OR (
      (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'examiner'::app_role))
      AND course_id IS NOT NULL
      AND public.is_course_staff(auth.uid(), course_id)
    )
  );

-- 4) zoom_licenses: scope student reads to enrolled classes only
DROP POLICY IF EXISTS "Students can view zoom licenses for joining classes" ON public.zoom_licenses;

CREATE POLICY "Students can view zoom licenses for enrolled classes"
  ON public.zoom_licenses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.course_classes cc
      JOIN public.course_class_students ccs ON ccs.class_id = cc.id
      WHERE cc.zoom_license_id = zoom_licenses.id
        AND ccs.student_id = auth.uid()
    )
  );
