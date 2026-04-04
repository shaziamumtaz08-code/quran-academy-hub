ALTER TABLE public.student_parent_links 
ADD COLUMN IF NOT EXISTS oversight_level text NOT NULL DEFAULT 'none';