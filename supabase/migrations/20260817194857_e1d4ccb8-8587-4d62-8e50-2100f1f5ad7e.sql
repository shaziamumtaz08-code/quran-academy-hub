
CREATE TABLE IF NOT EXISTS public.syllabus_items (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  title text not null,
  sequence_order integer not null default 0,
  reference jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_items TO authenticated;
GRANT ALL ON public.syllabus_items TO service_role;
ALTER TABLE public.syllabus_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syllabus_items_read" ON public.syllabus_items;
CREATE POLICY "syllabus_items_read" ON public.syllabus_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "syllabus_items_manage" ON public.syllabus_items;
CREATE POLICY "syllabus_items_manage" ON public.syllabus_items AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic'));

CREATE TABLE IF NOT EXISTS public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  current_item_id uuid references public.syllabus_items(id) on delete set null,
  current_page_or_ayah text,
  status text not null default 'in_progress',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS student_progress_student_uniq ON public.student_progress(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_progress TO authenticated;
GRANT ALL ON public.student_progress TO service_role;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_progress_staff_all" ON public.student_progress;
CREATE POLICY "student_progress_staff_all" ON public.student_progress AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "student_progress_own_read" ON public.student_progress;
CREATE POLICY "student_progress_own_read" ON public.student_progress AS PERMISSIVE FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links l WHERE l.parent_id = auth.uid() AND l.student_id = public.student_progress.student_id));

CREATE TABLE IF NOT EXISTS public.vcr_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  item_covered_id uuid references public.syllabus_items(id) on delete set null,
  reference_covered text,
  notes text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS vcr_sessions_student_idx ON public.vcr_sessions(student_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vcr_sessions TO authenticated;
GRANT ALL ON public.vcr_sessions TO service_role;
ALTER TABLE public.vcr_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vcr_sessions_staff_all" ON public.vcr_sessions;
CREATE POLICY "vcr_sessions_staff_all" ON public.vcr_sessions AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic') OR teacher_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic') OR teacher_id = auth.uid());
DROP POLICY IF EXISTS "vcr_sessions_own_read" ON public.vcr_sessions;
CREATE POLICY "vcr_sessions_own_read" ON public.vcr_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links l WHERE l.parent_id = auth.uid() AND l.student_id = public.vcr_sessions.student_id));

CREATE TABLE IF NOT EXISTS public.mistake_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vcr_sessions(id) on delete cascade,
  reference text not null,
  mistake_type text not null,
  note text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS mistake_log_session_idx ON public.mistake_log(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mistake_log TO authenticated;
GRANT ALL ON public.mistake_log TO service_role;
ALTER TABLE public.mistake_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mistake_log_staff_all" ON public.mistake_log;
CREATE POLICY "mistake_log_staff_all" ON public.mistake_log AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vcr_sessions s WHERE s.id = session_id AND (s.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vcr_sessions s WHERE s.id = session_id AND (s.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_academic'))));

INSERT INTO public.syllabus_items (level, title, sequence_order, reference)
SELECT 'Qaida', 'Baab ' || b.baab_number || ' — ' || b.name_english, b.baab_number,
       jsonb_build_object('baab_number', b.baab_number, 'start_page', b.start_page, 'end_page', b.end_page)
FROM public.noorani_qaida_baabs b
WHERE NOT EXISTS (SELECT 1 FROM public.syllabus_items s WHERE s.level = 'Qaida' AND s.sequence_order = b.baab_number);

INSERT INTO public.syllabus_items (level, title, sequence_order, reference)
SELECT 'Quran', 'Juz ' || g, 100 + g, jsonb_build_object('juz', g)
FROM generate_series(1,30) g
WHERE NOT EXISTS (SELECT 1 FROM public.syllabus_items s WHERE s.level = 'Quran' AND s.sequence_order = 100 + g);
