CREATE OR REPLACE FUNCTION public.fn_auto_create_subject_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _subjects_id uuid; _div uuid;
BEGIN
  _div := '00000000-0000-0000-0000-000000000003'::uuid;
  PERFORM public.ensure_division_root_folders(_div);
  SELECT id INTO _subjects_id FROM public.folders
    WHERE division_id = _div AND parent_id IS NULL AND name = 'Subjects' AND is_system = true LIMIT 1;
  IF _subjects_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.folders WHERE source_type = 'subject' AND source_id = NEW.id
  ) THEN
    INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type, source_id)
    VALUES (NEW.name, _subjects_id, _div, true, 'teachers', 'subject', NEW.id);
  END IF;
  RETURN NEW;
END; $function$;