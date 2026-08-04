ALTER TABLE public.noorani_qaida_baabs
  ADD COLUMN IF NOT EXISTS picker_mode text NOT NULL DEFAULT 'line_range',
  ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'word';

DO $$ BEGIN
  ALTER TABLE public.noorani_qaida_baabs
    ADD CONSTRAINT noorani_qaida_baabs_picker_mode_check
    CHECK (picker_mode IN ('word_dropdown','line_range'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.noorani_qaida_baabs SET picker_mode = 'word_dropdown' WHERE baab_number IN (1,2,3,6,9,13);
UPDATE public.noorani_qaida_baabs SET picker_mode = 'line_range' WHERE baab_number IN (4,5,7,8,10,11,12,14,15,16);
UPDATE public.noorani_qaida_baabs SET unit_label = 'word' WHERE baab_number BETWEEN 1 AND 12;
UPDATE public.noorani_qaida_baabs SET unit_label = 'phrase' WHERE baab_number = 13;
UPDATE public.noorani_qaida_baabs SET unit_label = 'line' WHERE baab_number IN (14,15,16);
UPDATE public.noorani_qaida_baabs SET total_units = 30 WHERE baab_number = 6;
UPDATE public.noorani_qaida_baabs SET total_units = 97 WHERE baab_number = 9;
UPDATE public.noorani_qaida_baabs SET total_units = 16 WHERE baab_number = 13;

CREATE TABLE IF NOT EXISTS public.noorani_qaida_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baab_id uuid NOT NULL REFERENCES public.noorani_qaida_baabs(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  line_number integer NOT NULL,
  word_position integer NOT NULL,
  word_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (baab_id, line_number, word_position)
);

GRANT SELECT ON public.noorani_qaida_words TO authenticated;
GRANT SELECT ON public.noorani_qaida_words TO anon;
GRANT ALL ON public.noorani_qaida_words TO service_role;

ALTER TABLE public.noorani_qaida_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qaida words readable by all" ON public.noorani_qaida_words;
CREATE POLICY "Qaida words readable by all" ON public.noorani_qaida_words FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage qaida words" ON public.noorani_qaida_words;
CREATE POLICY "Admins manage qaida words" ON public.noorani_qaida_words FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_qaida_words_updated_at ON public.noorani_qaida_words;
CREATE TRIGGER trg_qaida_words_updated_at BEFORE UPDATE ON public.noorani_qaida_words
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_qaida_words_baab_line ON public.noorani_qaida_words(baab_id, line_number, word_position);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS qaida_baab_id uuid REFERENCES public.noorani_qaida_baabs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qaida_word_from_id uuid REFERENCES public.noorani_qaida_words(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qaida_word_to_id uuid REFERENCES public.noorani_qaida_words(id) ON DELETE SET NULL;

UPDATE public.attendance a
SET qaida_baab_id = b.id
FROM public.noorani_qaida_baabs b
WHERE a.qaida_baab_id IS NULL
  AND a.qaida_page_id IS NOT NULL
  AND a.lesson_number = b.baab_number;