CREATE TABLE IF NOT EXISTS public.vcr_room_state (
  student_id uuid PRIMARY KEY,
  presenter_id uuid,
  presenter_name text,
  presenter_role text,
  sync_enabled boolean NOT NULL DEFAULT false,
  app text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vcr_room_state TO authenticated;
GRANT ALL ON public.vcr_room_state TO service_role;

ALTER TABLE public.vcr_room_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vcr_room_state_read" ON public.vcr_room_state
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'examiner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'admin_academic')
  OR public.has_role(auth.uid(), 'admin_division')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "vcr_room_state_write" ON public.vcr_room_state
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'admin_academic')
  OR public.has_role(auth.uid(), 'admin_division')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "vcr_room_state_update" ON public.vcr_room_state
AS PERMISSIVE FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'admin_academic')
  OR public.has_role(auth.uid(), 'admin_division')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'admin_academic')
  OR public.has_role(auth.uid(), 'admin_division')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER vcr_room_state_touch
BEFORE UPDATE ON public.vcr_room_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();