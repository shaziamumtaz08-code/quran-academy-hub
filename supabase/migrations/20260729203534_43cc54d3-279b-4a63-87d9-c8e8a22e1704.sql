CREATE TABLE public.zoom_booking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_account_id uuid REFERENCES public.zoom_accounts(id) ON DELETE SET NULL,
  seat_email text,
  seat_label text,
  seat_tier text,
  booked_by uuid,
  booked_by_name text,
  booked_by_role text,
  booked_at timestamptz NOT NULL DEFAULT now(),
  meeting_type text NOT NULL DEFAULT 'quick',
  topic text,
  start_time timestamptz,
  duration_minutes integer,
  timezone text,
  zoom_meeting_id text,
  join_url text,
  auto_record boolean NOT NULL DEFAULT false,
  course_class_id uuid,
  demo_session_id uuid,
  status text NOT NULL DEFAULT 'created',
  error_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoom_booking_audit_booked_at ON public.zoom_booking_audit_log (booked_at DESC);
CREATE INDEX idx_zoom_booking_audit_account ON public.zoom_booking_audit_log (zoom_account_id);
CREATE INDEX idx_zoom_booking_audit_booked_by ON public.zoom_booking_audit_log (booked_by);

GRANT SELECT ON public.zoom_booking_audit_log TO authenticated;
GRANT ALL ON public.zoom_booking_audit_log TO service_role;

ALTER TABLE public.zoom_booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all zoom booking logs"
ON public.zoom_booking_audit_log AS PERMISSIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own zoom bookings"
ON public.zoom_booking_audit_log AS PERMISSIVE FOR SELECT TO authenticated
USING (booked_by = auth.uid());