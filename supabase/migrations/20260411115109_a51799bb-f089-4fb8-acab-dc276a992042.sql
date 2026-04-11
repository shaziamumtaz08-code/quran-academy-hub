
-- Add auto_enroll_enabled to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS auto_enroll_enabled boolean NOT NULL DEFAULT false;

-- Add processing audit columns to registration_submissions
ALTER TABLE public.registration_submissions ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE public.registration_submissions ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.course_enrollments(id) ON DELETE SET NULL;
