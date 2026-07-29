
-- ENUMS
DO $$ BEGIN CREATE TYPE public.zoom_vault_account_type AS ENUM ('paid','free'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.zoom_pool_assignment AS ENUM ('shared','dedicated','unassigned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.zoom_vault_status AS ENUM ('active','disabled','locked_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.zoom_vault_field AS ENUM ('zoom_password','google_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.zoom_pool_booking_status AS ENUM ('booked','in_progress','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS public.zoom_vault_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  zoom_email text NOT NULL,
  zoom_password_secret_id uuid,
  google_email text,
  google_password_secret_id uuid,
  pmi text,
  passcode text,
  host_key text,
  account_type public.zoom_vault_account_type NOT NULL DEFAULT 'free',
  pool_assignment public.zoom_pool_assignment NOT NULL DEFAULT 'unassigned',
  assigned_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  auto_record boolean NOT NULL DEFAULT false,
  status public.zoom_vault_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zoom_vault_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_account_id uuid NOT NULL REFERENCES public.zoom_vault_accounts(id) ON DELETE CASCADE,
  viewed_by_user_id uuid NOT NULL,
  viewed_field public.zoom_vault_field NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zoom_pool_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_account_id uuid NOT NULL REFERENCES public.zoom_vault_accounts(id) ON DELETE CASCADE,
  booked_by_user_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'Other',
  meeting_link text,
  zoom_meeting_id text,
  recording_url text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status public.zoom_pool_booking_status NOT NULL DEFAULT 'booked',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zoom_pool_bookings_seat_time ON public.zoom_pool_bookings (vault_account_id, start_time, end_time);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoom_vault_accounts TO authenticated;
GRANT ALL ON public.zoom_vault_accounts TO service_role;
GRANT SELECT, INSERT ON public.zoom_vault_access_log TO authenticated;
GRANT ALL ON public.zoom_vault_access_log TO service_role;
GRANT SELECT, INSERT ON public.zoom_pool_bookings TO authenticated;
GRANT ALL ON public.zoom_pool_bookings TO service_role;

-- RLS
ALTER TABLE public.zoom_vault_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_vault_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_pool_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault accounts admin read" ON public.zoom_vault_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "vault accounts admin write" ON public.zoom_vault_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "vault accounts admin update" ON public.zoom_vault_accounts AS PERMISSIVE FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "vault accounts admin delete" ON public.zoom_vault_accounts AS PERMISSIVE FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "vault log admin read" ON public.zoom_vault_access_log AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "vault log admin insert" ON public.zoom_vault_access_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.teacher_pool_booking_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (setting_value #>> '{}')::boolean FROM public.app_settings WHERE setting_key = 'teacher_pool_booking_enabled'), false)
$$;

CREATE POLICY "pool bookings read" ON public.zoom_pool_bookings AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (booked_by_user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled())
);
CREATE POLICY "pool bookings insert" ON public.zoom_pool_bookings AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  booked_by_user_id = auth.uid()
  AND (public.is_admin(auth.uid()) OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled()))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_zoom_vault()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_zoom_vault_updated_at ON public.zoom_vault_accounts;
CREATE TRIGGER trg_zoom_vault_updated_at BEFORE UPDATE ON public.zoom_vault_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_zoom_vault();

-- ===== VAULT PASSWORD FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.set_vault_password(_account_id uuid, _field text, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _secret_id uuid; _existing uuid; _name text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF _field NOT IN ('zoom_password','google_password') THEN RAISE EXCEPTION 'Invalid field'; END IF;

  IF _field = 'zoom_password' THEN
    SELECT zoom_password_secret_id INTO _existing FROM public.zoom_vault_accounts WHERE id = _account_id;
  ELSE
    SELECT google_password_secret_id INTO _existing FROM public.zoom_vault_accounts WHERE id = _account_id;
  END IF;

  _name := 'zoom_vault_' || _account_id::text || '_' || _field;

  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _password, _name, 'Zoom vault credential');
    RETURN;
  END IF;

  _secret_id := vault.create_secret(_password, _name, 'Zoom vault credential');

  IF _field = 'zoom_password' THEN
    UPDATE public.zoom_vault_accounts SET zoom_password_secret_id = _secret_id WHERE id = _account_id;
  ELSE
    UPDATE public.zoom_vault_accounts SET google_password_secret_id = _secret_id WHERE id = _account_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reveal_vault_password(account_id uuid, field text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _secret_id uuid; _value text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF field NOT IN ('zoom_password','google_password') THEN RAISE EXCEPTION 'Invalid field'; END IF;

  IF field = 'zoom_password' THEN
    SELECT zoom_password_secret_id INTO _secret_id FROM public.zoom_vault_accounts WHERE id = account_id;
  ELSE
    SELECT google_password_secret_id INTO _secret_id FROM public.zoom_vault_accounts WHERE id = account_id;
  END IF;

  IF _secret_id IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO _value FROM vault.decrypted_secrets WHERE id = _secret_id;

  INSERT INTO public.zoom_vault_access_log (vault_account_id, viewed_by_user_id, viewed_field)
  VALUES (account_id, auth.uid(), field::public.zoom_vault_field);

  RETURN _value;
END $$;

-- ===== AVAILABILITY =====
CREATE OR REPLACE FUNCTION public.get_pool_availability(_start timestamptz DEFAULT now(), _end timestamptz DEFAULT now() + interval '1 day')
RETURNS TABLE (
  vault_account_id uuid,
  label text,
  account_type public.zoom_vault_account_type,
  auto_record boolean,
  is_available boolean,
  bookings jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled())) THEN
    RAISE EXCEPTION 'Not authorised to view pool availability';
  END IF;

  RETURN QUERY
  SELECT a.id, a.label, a.account_type, a.auto_record,
    NOT EXISTS (
      SELECT 1 FROM public.zoom_pool_bookings b
      WHERE b.vault_account_id = a.id AND b.status IN ('booked','in_progress')
        AND b.start_time < _end AND b.end_time > _start
    ) AS is_available,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'purpose', b.purpose, 'start_time', b.start_time,
        'end_time', b.end_time, 'status', b.status
      ) ORDER BY b.start_time)
      FROM public.zoom_pool_bookings b
      WHERE b.vault_account_id = a.id AND b.status IN ('booked','in_progress')
        AND b.start_time < _end AND b.end_time > _start
    ), '[]'::jsonb)
  FROM public.zoom_vault_accounts a
  WHERE a.pool_assignment = 'shared' AND a.status = 'active'
  ORDER BY a.account_type DESC, a.label;
END $$;

-- ===== BOOKING =====
CREATE OR REPLACE FUNCTION public.book_pool_seat(vault_account_id uuid, purpose text, start_time timestamptz, end_time timestamptz)
RETURNS TABLE (booking_id uuid, meeting_link text, recording_url text, seat_label text, records boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _seat public.zoom_vault_accounts%ROWTYPE; _link text; _id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled())) THEN
    RAISE EXCEPTION 'Not authorised to book a pool seat';
  END IF;
  IF end_time <= start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  SELECT * INTO _seat FROM public.zoom_vault_accounts
  WHERE id = vault_account_id AND pool_assignment = 'shared' AND status = 'active';
  IF _seat.id IS NULL THEN RAISE EXCEPTION 'Seat not found or not available in the shared pool'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.zoom_pool_bookings b
    WHERE b.vault_account_id = _seat.id AND b.status IN ('booked','in_progress')
      AND b.start_time < end_time AND b.end_time > start_time
  ) THEN RAISE EXCEPTION 'That seat is already booked for the selected window'; END IF;

  _link := 'https://zoom.us/j/' || regexp_replace(COALESCE(_seat.pmi,''), '\D', '', 'g')
    || CASE WHEN COALESCE(_seat.passcode,'') <> '' THEN '?pwd=' || _seat.passcode ELSE '' END;

  INSERT INTO public.zoom_pool_bookings (vault_account_id, booked_by_user_id, purpose, meeting_link, zoom_meeting_id, start_time, end_time, status)
  VALUES (_seat.id, auth.uid(), COALESCE(purpose,'Other'), _link, regexp_replace(COALESCE(_seat.pmi,''), '\D', '', 'g'), start_time, end_time, 'booked')
  RETURNING id INTO _id;

  RETURN QUERY SELECT _id, _link, NULL::text, _seat.label, _seat.auto_record;
END $$;

CREATE OR REPLACE FUNCTION public.update_pool_booking_status(_booking_id uuid, _status public.zoom_pool_booking_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.zoom_pool_bookings b WHERE b.id = _booking_id AND b.booked_by_user_id = auth.uid()
  )) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.zoom_pool_bookings SET status = _status WHERE id = _booking_id;
END $$;

REVOKE ALL ON FUNCTION public.set_vault_password(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.reveal_vault_password(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_pool_availability(timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.book_pool_seat(uuid, text, timestamptz, timestamptz) FROM anon;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('teacher_pool_booking_enabled', 'false'::jsonb, 'Allows teachers to view and book shared Zoom pool seats')
ON CONFLICT (setting_key) DO NOTHING;
