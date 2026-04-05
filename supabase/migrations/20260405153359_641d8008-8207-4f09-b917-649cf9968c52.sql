CREATE POLICY "Students can view zoom licenses for joining classes"
ON public.zoom_licenses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND status = 'busy'
  AND id IN (SELECT license_id FROM public.live_sessions WHERE status = 'live' AND license_id IS NOT NULL)
);