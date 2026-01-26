-- =====================================================
-- 1) FIX PROFILES: Add timezone field, make city optional text
-- =====================================================

-- Add timezone column to profiles (IANA timezone like Asia/Karachi)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Karachi';

-- Add country_code for ISO country storage
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'PK';

-- Add region/state field
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS region TEXT;

-- Update existing profiles: Set timezone based on existing timezone_mappings where available
UPDATE public.profiles p
SET timezone = COALESCE(
  (SELECT tm.timezone 
   FROM public.timezone_mappings tm 
   WHERE LOWER(tm.country) = LOWER(p.country) 
   AND LOWER(tm.city) = LOWER(p.city)
   LIMIT 1),
  CASE 
    WHEN LOWER(p.country) LIKE '%pakistan%' THEN 'Asia/Karachi'
    WHEN LOWER(p.country) LIKE '%canada%' THEN 'America/Toronto'
    WHEN LOWER(p.country) LIKE '%usa%' OR LOWER(p.country) LIKE '%united states%' THEN 'America/New_York'
    WHEN LOWER(p.country) LIKE '%uk%' OR LOWER(p.country) LIKE '%united kingdom%' THEN 'Europe/London'
    WHEN LOWER(p.country) LIKE '%uae%' OR LOWER(p.country) LIKE '%emirates%' THEN 'Asia/Dubai'
    WHEN LOWER(p.country) LIKE '%india%' THEN 'Asia/Kolkata'
    WHEN LOWER(p.country) LIKE '%saudi%' THEN 'Asia/Riyadh'
    WHEN LOWER(p.country) LIKE '%australia%' THEN 'Australia/Sydney'
    ELSE 'Asia/Karachi'
  END
)
WHERE p.timezone IS NULL OR p.timezone = 'Asia/Karachi';

-- =====================================================
-- 2) QURAN STRUCTURE: Create canonical surahs and rukus tables
-- =====================================================

-- Create surahs table
CREATE TABLE IF NOT EXISTS public.surahs (
  surah_number INTEGER PRIMARY KEY,
  surah_name_ar TEXT NOT NULL,
  surah_name_en TEXT NOT NULL,
  total_ayah INTEGER NOT NULL,
  revelation_type TEXT NOT NULL DEFAULT 'Meccan',
  juz_start INTEGER,
  juz_end INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on surahs
ALTER TABLE public.surahs ENABLE ROW LEVEL SECURITY;

-- Everyone can read surahs (reference data)
CREATE POLICY "Anyone can view surahs" ON public.surahs
  FOR SELECT USING (true);

-- Only super_admin can modify surahs
CREATE POLICY "Super admin can manage surahs" ON public.surahs
  FOR ALL USING (is_super_admin(auth.uid()));

-- Create rukus table with proper ayah ranges
CREATE TABLE IF NOT EXISTS public.rukus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number INTEGER NOT NULL REFERENCES public.surahs(surah_number),
  ruku_number INTEGER NOT NULL,
  ayah_from INTEGER NOT NULL,
  ayah_to INTEGER NOT NULL,
  juz_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(surah_number, ruku_number)
);

-- Enable RLS on rukus
ALTER TABLE public.rukus ENABLE ROW LEVEL SECURITY;

-- Everyone can read rukus (reference data)
CREATE POLICY "Anyone can view rukus" ON public.rukus
  FOR SELECT USING (true);

-- Only super_admin can modify rukus
CREATE POLICY "Super admin can manage rukus" ON public.rukus
  FOR ALL USING (is_super_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rukus_surah ON public.rukus(surah_number);
CREATE INDEX IF NOT EXISTS idx_rukus_juz ON public.rukus(juz_number);

-- =====================================================
-- 3) SCHEDULE OVERRIDES: For rescheduling specific lessons
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  original_date DATE NOT NULL,
  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(schedule_id, original_date)
);

-- Enable RLS on schedule_overrides
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage all overrides
CREATE POLICY "Admin can manage schedule overrides" ON public.schedule_overrides
  FOR ALL USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can create/view overrides for their schedules
CREATE POLICY "Teachers can manage their schedule overrides" ON public.schedule_overrides
  FOR ALL USING (
    has_role(auth.uid(), 'teacher'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
      WHERE s.id = schedule_overrides.schedule_id
      AND sta.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
      WHERE s.id = schedule_overrides.schedule_id
      AND sta.teacher_id = auth.uid()
    )
  );

-- Students can view overrides for their schedules
CREATE POLICY "Students can view their schedule overrides" ON public.schedule_overrides
  FOR SELECT USING (
    has_role(auth.uid(), 'student'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
      WHERE s.id = schedule_overrides.schedule_id
      AND sta.student_id = auth.uid()
    )
  );

-- Parents can view children's schedule overrides
CREATE POLICY "Parents can view children schedule overrides" ON public.schedule_overrides
  FOR SELECT USING (
    has_role(auth.uid(), 'parent'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
      WHERE s.id = schedule_overrides.schedule_id
      AND sta.student_id IN (SELECT get_parent_children_ids(auth.uid()))
    )
  );

-- Create indexes for schedule_overrides
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_schedule ON public.schedule_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_dates ON public.schedule_overrides(original_date, new_date);

-- =====================================================
-- 4) ADD subject_id TO schedules TABLE (if not exists)
-- =====================================================
-- Note: schedules table references assignment which already has subject_id
-- so no additional column needed

-- =====================================================
-- 5) CREATE UNIQUE CONSTRAINT ON SCHEDULES TO PREVENT DUPLICATES
-- =====================================================

-- First clean up any existing duplicates by keeping the most recent one
WITH duplicates AS (
  SELECT id, 
    ROW_NUMBER() OVER (
      PARTITION BY assignment_id, LOWER(day_of_week) 
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) as rn
  FROM public.schedules
)
DELETE FROM public.schedules 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Add unique constraint on assignment + day
ALTER TABLE public.schedules
DROP CONSTRAINT IF EXISTS schedules_assignment_day_unique;

ALTER TABLE public.schedules
ADD CONSTRAINT schedules_assignment_day_unique UNIQUE (assignment_id, day_of_week);

-- =====================================================
-- 6) TRIGGER TO PREVENT OVERLAPPING SCHEDULES FOR SAME STUDENT
-- =====================================================

CREATE OR REPLACE FUNCTION check_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
  student_id_val UUID;
  has_overlap BOOLEAN;
BEGIN
  -- Get the student_id from the assignment
  SELECT sta.student_id INTO student_id_val
  FROM public.student_teacher_assignments sta
  WHERE sta.id = NEW.assignment_id;
  
  -- Check for overlapping schedules for the same student on the same day
  SELECT EXISTS (
    SELECT 1 
    FROM public.schedules s
    JOIN public.student_teacher_assignments sta ON s.assignment_id = sta.id
    WHERE sta.student_id = student_id_val
    AND LOWER(s.day_of_week) = LOWER(NEW.day_of_week)
    AND s.is_active = true
    AND s.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      -- Check time overlap using student_local_time
      (s.student_local_time, s.student_local_time + (s.duration_minutes || ' minutes')::interval)
      OVERLAPS
      (NEW.student_local_time, NEW.student_local_time + (NEW.duration_minutes || ' minutes')::interval)
    )
  ) INTO has_overlap;
  
  IF has_overlap THEN
    RAISE EXCEPTION 'Schedule conflict: This student already has a class at this time on %', NEW.day_of_week;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS check_schedule_overlap_trigger ON public.schedules;

-- Create trigger
CREATE TRIGGER check_schedule_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION check_schedule_overlap();