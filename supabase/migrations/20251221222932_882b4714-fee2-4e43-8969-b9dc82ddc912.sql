-- Add Quran tracking fields to attendance table
ALTER TABLE public.attendance
ADD COLUMN lines_completed integer,
ADD COLUMN surah_name text,
ADD COLUMN ayah_from integer,
ADD COLUMN ayah_to integer,
ADD COLUMN variance_reason text;

-- Add mushaf preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN mushaf_type text NOT NULL DEFAULT '15-line',
ADD COLUMN daily_target_lines integer NOT NULL DEFAULT 10;