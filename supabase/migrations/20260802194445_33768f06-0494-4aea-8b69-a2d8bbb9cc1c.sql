CREATE TABLE public.noorani_qaida_baabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baab_number int NOT NULL UNIQUE,
  name_urdu text NOT NULL,
  name_english text NOT NULL,
  start_page int NOT NULL,
  end_page int NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('word','line')),
  total_units int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.noorani_qaida_baabs TO authenticated, anon;
GRANT ALL ON public.noorani_qaida_baabs TO service_role;
ALTER TABLE public.noorani_qaida_baabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qaida baabs readable by all" ON public.noorani_qaida_baabs FOR SELECT USING (true);
CREATE POLICY "Admins manage qaida baabs" ON public.noorani_qaida_baabs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.noorani_qaida_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_number int NOT NULL UNIQUE,
  baab_id uuid REFERENCES public.noorani_qaida_baabs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.noorani_qaida_pages TO authenticated, anon;
GRANT ALL ON public.noorani_qaida_pages TO service_role;
ALTER TABLE public.noorani_qaida_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qaida pages readable by all" ON public.noorani_qaida_pages FOR SELECT USING (true);
CREATE POLICY "Admins manage qaida pages" ON public.noorani_qaida_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.noorani_qaida_baabs (baab_number,name_urdu,name_english,start_page,end_page,unit_type,total_units) VALUES
 (1,'مفردات','Single Letters',2,2,'word',30),
 (2,'مرکبات','Joint Letters',3,5,'word',125),
 (3,'حروف مقطعات','Muqatta''aat Letters',6,6,'word',14),
 (4,'حرکات','Movements (Harkaat)',6,8,'word',78),
 (5,'تنوین','Tanween',8,9,'word',78),
 (6,'مشق حرکات و تنوین','Practice: Harkaat & Tanween',10,11,'word',54),
 (7,'کھڑی زبر، کھڑی زیر، الٹا پیش','Standing Fatha/Kasrah, Inverted Pesh',11,12,'word',33),
 (8,'مدہ ولین','Madd & Leen Letters',12,15,'word',126),
 (9,'مشق حرکات','Practice: Standing Vowels, Madd-Leen & Tanween',15,17,'word',108),
 (10,'سکون یعنی جزم','Sakoon / Jazm',18,19,'word',45),
 (11,'مشق سکون','Practice: Sakoon',19,23,'word',179),
 (12,'تشدید','Tashdeed',24,25,'word',70),
 (13,'مشق تشدید','Practice: Tashdeed',25,27,'word',65),
 (14,'مشق تشدید مع سکون','Tashdeed with Sakoon',27,28,'line',8),
 (15,'تشدید مع تشدید','Tashdeed with Tashdeed',28,28,'line',4),
 (16,'تشدید بعد حروف مدہ','Tashdeed after Madd Letters',29,31,'line',22);

INSERT INTO public.noorani_qaida_pages (page_number, baab_id)
SELECT p.n, (
  SELECT b.id FROM public.noorani_qaida_baabs b
  WHERE p.n BETWEEN b.start_page AND b.end_page
  ORDER BY b.baab_number LIMIT 1
)
FROM generate_series(1,32) AS p(n);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS qaida_page_id uuid REFERENCES public.noorani_qaida_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qaida_unit_from int,
  ADD COLUMN IF NOT EXISTS qaida_unit_to int;

CREATE INDEX IF NOT EXISTS idx_attendance_qaida_page ON public.attendance(qaida_page_id);

CREATE TRIGGER trg_qaida_baabs_updated_at BEFORE UPDATE ON public.noorani_qaida_baabs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();