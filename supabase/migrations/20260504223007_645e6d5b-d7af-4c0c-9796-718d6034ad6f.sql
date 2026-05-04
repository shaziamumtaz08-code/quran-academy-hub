
-- 1. Folder access columns
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS visible_to_user_ids uuid[] DEFAULT '{}';
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES public.divisions(id);
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS source_id uuid;

UPDATE public.folders SET division_id = '00000000-0000-0000-0000-000000000003' WHERE division_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_division ON public.folders(division_id);
CREATE INDEX IF NOT EXISTS idx_folders_source ON public.folders(source_type, source_id);

-- 2. Extended visibility check (3-arg overload)
CREATE OR REPLACE FUNCTION public.can_view_resource_visibility(_visibility text, _visible_to_roles text[], _visible_to_user_ids uuid[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF is_admin(_user_id) OR is_super_admin(_user_id) THEN RETURN true; END IF;
  IF _visible_to_user_ids IS NOT NULL AND _user_id = ANY(_visible_to_user_ids) THEN RETURN true; END IF;
  RETURN public.can_view_resource_visibility(_visibility, _visible_to_roles);
END; $$;

-- 3. Auto-create root division folders
CREATE OR REPLACE FUNCTION public.ensure_division_root_folders(_division_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _courses_id uuid; _subjects_id uuid; _general_id uuid;
BEGIN
  SELECT id INTO _courses_id FROM public.folders
    WHERE division_id = _division_id AND parent_id IS NULL AND name = 'Courses' AND is_system = true LIMIT 1;
  IF _courses_id IS NULL THEN
    INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type)
    VALUES ('Courses', NULL, _division_id, true, 'teachers', 'auto_group') RETURNING id INTO _courses_id;
  END IF;

  SELECT id INTO _subjects_id FROM public.folders
    WHERE division_id = _division_id AND parent_id IS NULL AND name = 'Subjects' AND is_system = true LIMIT 1;
  IF _subjects_id IS NULL THEN
    INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type)
    VALUES ('Subjects', NULL, _division_id, true, 'teachers', 'auto_group') RETURNING id INTO _subjects_id;
  END IF;

  SELECT id INTO _general_id FROM public.folders
    WHERE division_id = _division_id AND parent_id IS NULL AND name = 'General' AND is_system = true LIMIT 1;
  IF _general_id IS NULL THEN
    INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type)
    VALUES ('General', NULL, _division_id, true, 'all', 'auto_group');
  END IF;
END; $$;

-- Seed root folders for all existing divisions
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.divisions WHERE is_active = true LOOP
    PERFORM public.ensure_division_root_folders(r.id);
  END LOOP;
END $$;

-- 4. Course folder auto-create trigger
CREATE OR REPLACE FUNCTION public.fn_auto_create_course_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _courses_id uuid;
BEGIN
  IF NEW.division_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.ensure_division_root_folders(NEW.division_id);
  SELECT id INTO _courses_id FROM public.folders
    WHERE division_id = NEW.division_id AND parent_id IS NULL AND name = 'Courses' AND is_system = true LIMIT 1;
  IF _courses_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.folders WHERE source_type = 'course' AND source_id = NEW.id
  ) THEN
    INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type, source_id)
    VALUES (NEW.name, _courses_id, NEW.division_id, true, 'teachers', 'course', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_create_course_folder ON public.courses;
CREATE TRIGGER trg_auto_create_course_folder AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_course_folder();

-- 5. Subject folder auto-create trigger
CREATE OR REPLACE FUNCTION public.fn_auto_create_subject_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _subjects_id uuid; _div uuid;
BEGIN
  _div := COALESCE(NEW.division_id, '00000000-0000-0000-0000-000000000003'::uuid);
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
END; $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subjects') THEN
    DROP TRIGGER IF EXISTS trg_auto_create_subject_folder ON public.subjects;
    CREATE TRIGGER trg_auto_create_subject_folder AFTER INSERT ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_subject_folder();
  END IF;
END $$;

-- Seed folders for existing courses/subjects
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id, name, division_id FROM public.courses WHERE division_id IS NOT NULL LOOP
    PERFORM public.ensure_division_root_folders(r.division_id);
    IF NOT EXISTS (SELECT 1 FROM public.folders WHERE source_type='course' AND source_id=r.id) THEN
      INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type, source_id)
      SELECT r.name, f.id, r.division_id, true, 'teachers', 'course', r.id
      FROM public.folders f
      WHERE f.division_id = r.division_id AND f.parent_id IS NULL AND f.name='Courses' AND f.is_system=true
      LIMIT 1;
    END IF;
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; _div uuid; BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subjects') THEN
    FOR r IN SELECT id, name FROM public.subjects LOOP
      _div := '00000000-0000-0000-0000-000000000003'::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.folders WHERE source_type='subject' AND source_id=r.id) THEN
        INSERT INTO public.folders(name, parent_id, division_id, is_system, visibility, source_type, source_id)
        SELECT r.name, f.id, _div, true, 'teachers', 'subject', r.id
        FROM public.folders f
        WHERE f.division_id = _div AND f.parent_id IS NULL AND f.name='Subjects' AND f.is_system=true
        LIMIT 1;
      END IF;
    END LOOP;
  END IF;
END $$;
