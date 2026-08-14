CREATE TABLE public.quran_ayahs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  text_indopak text,
  text_uthmani text,
  juz_number integer,
  hizb_quarter integer,
  ruku_number integer,
  sajdah boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah_number, ayah_number)
);
GRANT SELECT ON public.quran_ayahs TO authenticated;
GRANT ALL ON public.quran_ayahs TO service_role;
ALTER TABLE public.quran_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read quran ayahs" ON public.quran_ayahs AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mushaf_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  script text NOT NULL DEFAULT 'indopak',
  lines_per_page integer NOT NULL DEFAULT 15,
  total_pages integer NOT NULL DEFAULT 610,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mushaf_editions TO authenticated;
GRANT ALL ON public.mushaf_editions TO service_role;
ALTER TABLE public.mushaf_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read mushaf editions" ON public.mushaf_editions AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mushaf_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.mushaf_editions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  juz_number integer,
  surah_start integer,
  surah_end integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, page_number)
);
GRANT SELECT ON public.mushaf_pages TO authenticated;
GRANT ALL ON public.mushaf_pages TO service_role;
ALTER TABLE public.mushaf_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read mushaf pages" ON public.mushaf_pages AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mushaf_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.mushaf_editions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  line_number integer NOT NULL,
  line_type text NOT NULL DEFAULT 'ayah',
  surah_number integer,
  first_surah integer,
  first_ayah integer,
  first_word_index integer,
  last_surah integer,
  last_ayah integer,
  last_word_index integer,
  is_centered boolean NOT NULL DEFAULT false,
  text_indopak text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, page_number, line_number)
);
CREATE INDEX idx_mushaf_lines_page ON public.mushaf_lines (edition_id, page_number);
CREATE INDEX idx_mushaf_lines_ayah ON public.mushaf_lines (edition_id, first_surah, first_ayah);
GRANT SELECT ON public.mushaf_lines TO authenticated;
GRANT ALL ON public.mushaf_lines TO service_role;
ALTER TABLE public.mushaf_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read mushaf lines" ON public.mushaf_lines AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mushaf_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.mushaf_editions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  line_number integer NOT NULL,
  word_index integer NOT NULL,
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, page_number, line_number, word_index)
);
CREATE INDEX idx_mushaf_words_page ON public.mushaf_words (edition_id, page_number);
GRANT SELECT ON public.mushaf_words TO authenticated;
GRANT ALL ON public.mushaf_words TO service_role;
ALTER TABLE public.mushaf_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read mushaf words" ON public.mushaf_words AS PERMISSIVE FOR SELECT TO authenticated USING (true);

INSERT INTO public.mushaf_editions (code, name, script, lines_per_page, total_pages, is_default, notes)
VALUES ('qudratullah-15', 'Qudratullah 15-Line IndoPak Mushaf', 'indopak', 15, 610, true, 'Layout data sourced from QUL (Quranic Universal Library)');