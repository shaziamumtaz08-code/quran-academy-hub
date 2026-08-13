ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_reason_category_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_reason_category_check CHECK (
  reason_category IS NULL OR reason_category = ANY (ARRAY['sick','personal','emergency','internet_issue','family','travel','periods','other']::text[])
);