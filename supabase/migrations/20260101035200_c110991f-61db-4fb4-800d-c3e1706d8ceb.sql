-- Add structure_json column to exam_templates for flexible report card structures
ALTER TABLE public.exam_templates 
ADD COLUMN structure_json JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.exam_templates.structure_json IS 'JSON structure containing sections with criteria rows. Each section has title and criteria array. Each criteria has title, type (numeric/skill), maxMarks (if numeric), and skillLabels (if skill type).';