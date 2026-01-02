-- Create grading_style enum
CREATE TYPE public.grading_style AS ENUM ('numeric', 'rubric');

-- Add grading_style column to exam_templates
ALTER TABLE public.exam_templates
ADD COLUMN grading_style public.grading_style NOT NULL DEFAULT 'numeric';