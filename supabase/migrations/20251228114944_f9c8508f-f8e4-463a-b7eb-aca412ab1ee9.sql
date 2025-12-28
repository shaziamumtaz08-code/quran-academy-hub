-- Add lesson type and related columns for Qaida/Nazra/Hifz tracking
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS lesson_type text DEFAULT 'nazra',
ADD COLUMN IF NOT EXISTS sabaq_pages text,
ADD COLUMN IF NOT EXISTS sabqi_notes text,
ADD COLUMN IF NOT EXISTS manzil_completed boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.attendance.lesson_type IS 'Type of lesson: qaida, nazra, or hifz';
COMMENT ON COLUMN public.attendance.sabaq_pages IS 'For Qaida: current page/lesson number';
COMMENT ON COLUMN public.attendance.sabqi_notes IS 'For Hifz: recent revision notes';
COMMENT ON COLUMN public.attendance.manzil_completed IS 'For Hifz: whether manzil was heard/completed';