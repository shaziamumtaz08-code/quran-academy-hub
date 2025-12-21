-- Create resources table
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('pdf', 'audio', 'video', 'image', 'zip', 'link')),
  url text NOT NULL,
  folder text NOT NULL,
  tags text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view resources
CREATE POLICY "Authenticated users can view resources"
ON public.resources
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and super_admin can manage resources
CREATE POLICY "Admin can manage resources"
ON public.resources
FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can upload resources
CREATE POLICY "Teachers can insert resources"
ON public.resources
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can update/delete their own resources
CREATE POLICY "Teachers can update own resources"
ON public.resources
FOR UPDATE
USING (has_role(auth.uid(), 'teacher'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Teachers can delete own resources"
ON public.resources
FOR DELETE
USING (has_role(auth.uid(), 'teacher'::app_role) AND uploaded_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resources
INSERT INTO storage.buckets (id, name, public) VALUES ('resources', 'resources', true);

-- Storage policies
CREATE POLICY "Anyone can view resource files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'resources');

CREATE POLICY "Admin and teachers can upload resource files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resources' AND 
  (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role))
);

CREATE POLICY "Admin and teachers can delete resource files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'resources' AND 
  (is_admin(auth.uid()) OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role))
);