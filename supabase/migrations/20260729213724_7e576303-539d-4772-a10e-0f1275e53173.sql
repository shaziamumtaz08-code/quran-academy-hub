CREATE UNIQUE INDEX IF NOT EXISTS zoom_vault_accounts_email_uidx
  ON public.zoom_vault_accounts (lower(zoom_email));

CREATE OR REPLACE FUNCTION public.sync_vault_from_zoom_accounts()
RETURNS TABLE(imported integer, updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _imp integer := 0; _upd integer := 0; r record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  FOR r IN
    SELECT za.zoom_account_email AS email, za.teacher_id, za.tier, p.full_name
    FROM public.zoom_accounts za
    LEFT JOIN public.profiles p ON p.id = za.teacher_id
    WHERE za.is_active AND COALESCE(za.zoom_account_email,'') <> ''
  LOOP
    IF EXISTS (SELECT 1 FROM public.zoom_vault_accounts v WHERE lower(v.zoom_email) = lower(r.email)) THEN
      UPDATE public.zoom_vault_accounts v
      SET assigned_teacher_id = COALESCE(v.assigned_teacher_id, r.teacher_id),
          account_type = CASE WHEN r.tier = 'licensed' THEN 'paid'::zoom_vault_account_type ELSE v.account_type END
      WHERE lower(v.zoom_email) = lower(r.email);
      _upd := _upd + 1;
    ELSE
      INSERT INTO public.zoom_vault_accounts
        (label, zoom_email, account_type, pool_assignment, assigned_teacher_id, auto_record, status)
      VALUES (
        COALESCE(r.full_name, split_part(r.email, '@', 1)),
        r.email,
        CASE WHEN r.tier = 'licensed' THEN 'paid' ELSE 'free' END::zoom_vault_account_type,
        CASE WHEN r.teacher_id IS NULL THEN 'shared' ELSE 'dedicated' END::zoom_pool_assignment,
        r.teacher_id,
        (r.tier = 'licensed' AND r.teacher_id IS NULL),
        'active'::zoom_vault_status
      );
      _imp := _imp + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _imp, _upd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_vault_from_zoom_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pool_day_schedule(_day date, _tz text DEFAULT 'Asia/Karachi')
RETURNS TABLE(
  vault_account_id uuid,
  label text,
  account_type zoom_vault_account_type,
  auto_record boolean,
  bookings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE a.pool_assignment = 'shared' AND a.status = 'active'
  ORDER BY a.account_type DESC, a.label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_day_schedule(date, text) TO authenticated;