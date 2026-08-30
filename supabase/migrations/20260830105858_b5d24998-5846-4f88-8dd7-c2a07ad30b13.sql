CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.zoom_pool_bookings
  DROP CONSTRAINT IF EXISTS zoom_pool_bookings_no_overlap;

ALTER TABLE public.zoom_pool_bookings
  ADD CONSTRAINT zoom_pool_bookings_no_overlap
  EXCLUDE USING gist (
    vault_account_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('booked','in_progress'));

CREATE OR REPLACE FUNCTION public.get_pool_availability(_start timestamp with time zone DEFAULT now(), _end timestamp with time zone DEFAULT (now() + '1 day'::interval))
 RETURNS TABLE(vault_account_id uuid, label text, account_type zoom_vault_account_type, auto_record boolean, is_available boolean, bookings jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE a.zoom_account_id IS NULL AND a.status = 'active'
  ORDER BY a.account_type DESC, a.label;
END $function$;

CREATE OR REPLACE FUNCTION public.get_pool_day_schedule(_day date, _tz text DEFAULT 'Asia/Karachi'::text)
 RETURNS TABLE(vault_account_id uuid, label text, account_type zoom_vault_account_type, auto_record boolean, bookings jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _start timestamptz; _end timestamptz;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled())) THEN
    RAISE EXCEPTION 'Not authorised to view pool schedule';
  END IF;

  _start := (_day::text || ' 00:00')::timestamp AT TIME ZONE _tz;
  _end := _start + interval '1 day';

  RETURN QUERY
  SELECT a.id, a.label, a.account_type, a.auto_record,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'purpose', b.purpose, 'start_time', b.start_time,
        'end_time', b.end_time, 'status', b.status,
        'booked_by', COALESCE(p.full_name, 'Staff'),
        'mine', b.booked_by_user_id = auth.uid()
      ) ORDER BY b.start_time)
      FROM public.zoom_pool_bookings b
      LEFT JOIN public.profiles p ON p.id = b.booked_by_user_id
      WHERE b.vault_account_id = a.id
        AND b.status IN ('booked','in_progress')
        AND b.start_time < _end AND b.end_time > _start
    ), '[]'::jsonb)
  FROM public.zoom_vault_accounts a
  WHERE a.zoom_account_id IS NULL AND a.status = 'active'
  ORDER BY a.account_type DESC, a.label;
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_pool_seat(vault_account_id uuid, purpose text, start_time timestamp with time zone, end_time timestamp with time zone)
 RETURNS TABLE(booking_id uuid, meeting_link text, recording_url text, seat_label text, records boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _seat public.zoom_vault_accounts%ROWTYPE; _link text; _id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_pool_booking_enabled())) THEN
    RAISE EXCEPTION 'Not authorised to book a pool seat';
  END IF;
  IF end_time <= start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;

  SELECT * INTO _seat FROM public.zoom_vault_accounts
  WHERE id = vault_account_id AND zoom_account_id IS NULL AND status = 'active'
  FOR UPDATE;
  IF _seat.id IS NULL THEN
    RAISE EXCEPTION 'That seat is not a spare pool account (it belongs to a teacher) or is not active';
  END IF;

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
END $function$;