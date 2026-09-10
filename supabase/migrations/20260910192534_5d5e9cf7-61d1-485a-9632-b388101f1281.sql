CREATE TABLE public.syllabus_folder_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.course_classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_folder_links_target_check CHECK (course_id IS NOT NULL OR class_id IS NOT NULL OR subject_id IS NOT NULL)
);

GRANT SELECT ON public.syllabus_folder_links TO authenticated;
GRANT ALL ON public.syllabus_folder_links TO service_role;

ALTER TABLE public.syllabus_folder_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read syllabus folder links"
  ON public.syllabus_folder_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage syllabus folder links"
  ON public.syllabus_folder_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.syllabus_folder_links TO authenticated;

CREATE UNIQUE INDEX syllabus_folder_links_unique
  ON public.syllabus_folder_links (folder, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX syllabus_folder_links_course_idx ON public.syllabus_folder_links (course_id);
CREATE INDEX syllabus_folder_links_class_idx ON public.syllabus_folder_links (class_id);
CREATE INDEX syllabus_folder_links_subject_idx ON public.syllabus_folder_links (subject_id);

CREATE TRIGGER update_syllabus_folder_links_updated_at
  BEFORE UPDATE ON public.syllabus_folder_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();