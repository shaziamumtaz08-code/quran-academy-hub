DROP POLICY IF EXISTS "Authenticated insert video library" ON public.video_library;
CREATE POLICY "Staff insert video library" ON public.video_library
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );