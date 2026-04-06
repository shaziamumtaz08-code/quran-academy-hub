
-- Add license_type and priority columns to zoom_licenses
ALTER TABLE public.zoom_licenses
  ADD COLUMN IF NOT EXISTS license_type text NOT NULL DEFAULT 'licensed',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- Insert default allocation mode setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('zoom_allocation_mode', '"round_robin"', 'Zoom room allocation mode: priority or round_robin')
ON CONFLICT (setting_key) DO NOTHING;

-- Update get_and_reserve_license to respect allocation mode and priority
CREATE OR REPLACE FUNCTION public.get_and_reserve_license(_teacher_id uuid, _session_id uuid)
 RETURNS TABLE(license_id uuid, meeting_link text, zoom_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  selected_license RECORD;
  allocation_mode text;
BEGIN
  -- Read allocation mode from app_settings
  SELECT (setting_value #>> '{}') INTO allocation_mode
  FROM app_settings
  WHERE setting_key = 'zoom_allocation_mode';

  allocation_mode := COALESCE(allocation_mode, 'round_robin');

  IF allocation_mode = 'priority' THEN
    SELECT zl.id, zl.meeting_link, zl.zoom_email INTO selected_license
    FROM zoom_licenses zl
    WHERE zl.status = 'available'
    ORDER BY zl.priority ASC, zl.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  ELSE
    SELECT zl.id, zl.meeting_link, zl.zoom_email INTO selected_license
    FROM zoom_licenses zl
    WHERE zl.status = 'available'
    ORDER BY zl.last_used_at ASC NULLS FIRST
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF selected_license IS NULL THEN
    RAISE EXCEPTION 'All Zoom rooms are currently occupied.';
  END IF;

  UPDATE zoom_licenses
  SET status = 'busy', last_used_at = now()
  WHERE id = selected_license.id;

  UPDATE live_sessions
  SET license_id = selected_license.id,
      status = 'live',
      actual_start = now()
  WHERE id = _session_id AND teacher_id = _teacher_id;

  RETURN QUERY SELECT selected_license.id, selected_license.meeting_link, selected_license.zoom_email;
END;
$function$;
