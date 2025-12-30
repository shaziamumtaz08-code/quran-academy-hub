-- Add new fields for non-Quran subject planning (e.g., English, Math)
ALTER TABLE public.student_monthly_plans 
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resource_name text,
ADD COLUMN IF NOT EXISTS goals text,
ADD COLUMN IF NOT EXISTS topics_to_cover text,
ADD COLUMN IF NOT EXISTS page_from integer,
ADD COLUMN IF NOT EXISTS page_to integer,
ADD COLUMN IF NOT EXISTS surah_name text,
ADD COLUMN IF NOT EXISTS ayah_from integer,
ADD COLUMN IF NOT EXISTS ayah_to integer;