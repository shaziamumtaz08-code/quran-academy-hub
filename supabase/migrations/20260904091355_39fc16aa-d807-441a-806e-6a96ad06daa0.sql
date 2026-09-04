CREATE TABLE IF NOT EXISTS public.vcr_observer_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id uuid NOT NULL,
  student_id uuid,
  all_students boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vcr_observer_scopes TO authenticated;
GRANT ALL ON public.vcr_observer_scopes TO service_role;

ALTER TABLE public.vcr_observer_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Observers can see their own scopes"
ON public.vcr_observer_scopes FOR SELECT TO authenticated
USING (
  observer_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins manage observer scopes"
ON public.vcr_observer_scopes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_vcr_observer_scopes_observer ON public.vcr_observer_scopes(observer_id);
CREATE INDEX IF NOT EXISTS idx_vcr_observer_scopes_student ON public.vcr_observer_scopes(student_id);

CREATE TRIGGER update_vcr_observer_scopes_updated_at
BEFORE UPDATE ON public.vcr_observer_scopes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_observe_vcr(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.vcr_observer_scopes s
      WHERE s.observer_id = auth.uid()
        AND (s.all_students OR s.student_id = _student_id)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_observe_vcr(uuid) FROM anon;

ALTER TABLE public.vcr_call_logs ADD COLUMN IF NOT EXISTS observer_id uuid;
ALTER TABLE public.vcr_call_logs ADD COLUMN IF NOT EXISTS observer_joined boolean NOT NULL DEFAULT false;