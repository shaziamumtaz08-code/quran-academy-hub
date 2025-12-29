-- 1. Add 'yearly' to exam_tenure enum
ALTER TYPE public.exam_tenure ADD VALUE IF NOT EXISTS 'yearly';

-- 2. Add super_admin to subjects management RLS policies
DROP POLICY IF EXISTS "Admin can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Super admin can manage subjects" ON public.subjects;

CREATE POLICY "Admin can manage subjects" 
ON public.subjects 
FOR ALL 
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 3. Insert default subjects 'Hifz' and 'Nazrah' if they don't exist
INSERT INTO public.subjects (name, description, is_active)
SELECT 'Hifz', 'Quran memorization course', true
WHERE NOT EXISTS (SELECT 1 FROM public.subjects WHERE LOWER(name) = 'hifz');

INSERT INTO public.subjects (name, description, is_active)
SELECT 'Nazrah', 'Quran reading with proper pronunciation', true
WHERE NOT EXISTS (SELECT 1 FROM public.subjects WHERE LOWER(name) = 'nazrah');