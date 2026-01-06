-- Store per-criteria results for each exam report
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS criteria_values_json jsonb NULL;

-- Helpful index for filtering/searching (optional but lightweight)
CREATE INDEX IF NOT EXISTS idx_exams_criteria_values_json ON public.exams USING gin (criteria_values_json);
