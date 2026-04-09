
-- Add language preference to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teaching_os_language text NOT NULL DEFAULT 'en';

-- Add language tracking to content tables
ALTER TABLE public.syllabi ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.session_plans ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.content_kits ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.teaching_exams ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
