-- Create folders table with self-referencing parent for unlimited nesting
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, parent_id)
);

-- Add folder_id to resources table (nullable for migration)
ALTER TABLE public.resources 
ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

-- Enable RLS on folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
-- Admin and Super Admin can manage all folders
CREATE POLICY "Admin can manage all folders"
ON public.folders
FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can create folders
CREATE POLICY "Teachers can insert folders"
ON public.folders
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can update own folders
CREATE POLICY "Teachers can update own folders"
ON public.folders
FOR UPDATE
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Teachers can delete own folders
CREATE POLICY "Teachers can delete own folders"
ON public.folders
FOR DELETE
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Authenticated users can view all folders
CREATE POLICY "Authenticated users can view folders"
ON public.folders
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Update trigger for folders
CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for parent lookups
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX idx_resources_folder_id ON public.resources(folder_id);