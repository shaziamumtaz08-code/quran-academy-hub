-- Backfill missing student_parent_links from audit CSV (33 rows)
-- Idempotent: skips if link already exists. Creates parent profile if missing.

DO $audit_0$
DECLARE
  _student_id uuid;
  _parent_id  uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles
  WHERE lower(email) = 'aisha.sh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN
    RAISE NOTICE 'Skip aisha.sh@alqurantimeacademy.com: student not found'; RETURN;
  END IF;
  SELECT id INTO _parent_id FROM public.profiles
  WHERE lower(email) = 'nabihanoor247@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN
    SELECT id INTO _parent_id FROM public.profiles
    WHERE whatsapp_number = '923227896508' AND archived_at IS NULL LIMIT 1;
  END IF;
  IF _parent_id IS NULL THEN
    INSERT INTO public.profiles (full_name, email, whatsapp_number, country, guardian_type)
    VALUES ('Shezadi Bibi', 'nabihanoor247@gmail.com', '923227896508', 'Pakistan', 'parent')
    RETURNING id INTO _parent_id;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_0$;

DO $audit_1$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'aqsa.ya@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RAISE NOTICE 'Skip aqsa.ya'; RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE lower(email) = 'imt_12345@hotmail.com' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923008267194' AND archived_at IS NULL LIMIT 1; END IF;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, email, whatsapp_number, country, guardian_type) VALUES ('Yasmin', 'imt_12345@hotmail.com', '923008267194', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_1$;

DO $audit_2$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'areeba.ma@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923008228996' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, whatsapp_number, country, guardian_type) VALUES ('Ghazala Afzaal', '923008228996', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_2$;

DO $audit_3$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'arfa.ha@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE lower(email) = 'javedahmedofficial1@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923323327747' AND archived_at IS NULL LIMIT 1; END IF;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, email, whatsapp_number, country, guardian_type) VALUES ('Hakim', 'javedahmedofficial1@gmail.com', '923323327747', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_3$;

DO $audit_4$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'asma.ya@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE lower(email) = 'asmaamin843@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923233368192' AND archived_at IS NULL LIMIT 1; END IF;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, email, whatsapp_number, country, guardian_type) VALUES ('Yasmeen Karim', 'asmaamin843@gmail.com', '923233368192', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_4$;

DO $audit_5$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'asma.sa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '5857640680' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, whatsapp_number, country, guardian_type) VALUES ('Safia', '5857640680', 'United States', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_5$;

DO $audit_6$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'asma.sa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923242328002' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, whatsapp_number, country, guardian_type) VALUES ('Salon Nisa', '923242328002', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_6$;

DO $audit_7$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'faiza.fa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '923144548677' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, whatsapp_number, country, guardian_type) VALUES ('Fareeda Khanam', '923144548677', 'Pakistan', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_7$;

DO $audit_8$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'farheen.kh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles (full_name, guardian_type) VALUES ('Khalida Siddique', 'parent') RETURNING id INTO _parent_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
END $audit_8$;

DO $audit_9$
DECLARE _student_id uuid; _parent_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.profiles WHERE lower(email) = 'aairha.ra@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _student_id IS NULL THEN RETURN; END IF;
  SELECT id INTO _parent_id FROM public.profiles WHERE lower(email) = 'omesubhan@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _parent_id IS NULL THEN SELECT id INTO _parent_id FROM public.profiles WHERE whatsapp_number = '00971501192662' AND archived_at IS NULL LIMIT 1; END IF;
  IF _parent_id IS NULL THEN INSERT INTO public.profiles (full_name, email, whatsapp_number, country, guardian_type) VALUES ('Rabia Nasim', 'omesubhan@gmail.com', '00971501192662', 'United Arab Emirates', 'parent') RETURNING id INTO _parent_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_parent_id, 'parent'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.student_parent_links WHERE student_id = _student_id AND parent_id = _parent_id) THEN
    INSERT INTO public.student_parent_links (student_id, parent_id) VALUES (_student_id, _parent_id);
  END IF;
END $audit_9$;