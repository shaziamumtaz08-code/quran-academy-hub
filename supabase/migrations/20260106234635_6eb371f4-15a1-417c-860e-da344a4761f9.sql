-- Add new columns to student_monthly_plans for Quran tracking
ALTER TABLE public.student_monthly_plans 
ADD COLUMN IF NOT EXISTS teaching_strategy TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS surah_from TEXT,
ADD COLUMN IF NOT EXISTS surah_to TEXT,
ADD COLUMN IF NOT EXISTS lesson_number_from INTEGER,
ADD COLUMN IF NOT EXISTS lesson_number_to INTEGER,
ADD COLUMN IF NOT EXISTS total_teaching_days INTEGER,
ADD COLUMN IF NOT EXISTS calculated_daily_target NUMERIC;

-- Add new columns to attendance for subject-specific tracking
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS sabqi_done BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manzil_done BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sabaq_surah_from TEXT,
ADD COLUMN IF NOT EXISTS sabaq_surah_to TEXT,
ADD COLUMN IF NOT EXISTS sabaq_ayah_from INTEGER,
ADD COLUMN IF NOT EXISTS sabaq_ayah_to INTEGER,
ADD COLUMN IF NOT EXISTS lesson_number INTEGER,
ADD COLUMN IF NOT EXISTS page_number INTEGER;

-- Add meeting link to profiles for fallback
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.student_monthly_plans.teaching_strategy IS 'normal = Al-Fatiha onwards, reverse = An-Nas backwards';
COMMENT ON COLUMN public.attendance.sabqi_done IS 'Hifz: Recent revision completed';
COMMENT ON COLUMN public.attendance.manzil_done IS 'Hifz/Nazra: Old revision completed';