ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS sabaq_marker_type text
    CHECK (sabaq_marker_type IN ('ayah','ruku','quarter') OR sabaq_marker_type IS NULL),
  ADD COLUMN IF NOT EXISTS sabaq_ruku_from_juz integer,
  ADD COLUMN IF NOT EXISTS sabaq_ruku_from_number integer,
  ADD COLUMN IF NOT EXISTS sabaq_ruku_to_juz integer,
  ADD COLUMN IF NOT EXISTS sabaq_ruku_to_number integer,
  ADD COLUMN IF NOT EXISTS sabaq_quarter_from_juz integer,
  ADD COLUMN IF NOT EXISTS sabaq_quarter_from_number integer,
  ADD COLUMN IF NOT EXISTS sabaq_quarter_to_juz integer,
  ADD COLUMN IF NOT EXISTS sabaq_quarter_to_number integer;

COMMENT ON COLUMN public.attendance.sabaq_marker_type IS
  'How sabaq position is expressed: ayah | ruku | quarter. Defaults to ayah.';