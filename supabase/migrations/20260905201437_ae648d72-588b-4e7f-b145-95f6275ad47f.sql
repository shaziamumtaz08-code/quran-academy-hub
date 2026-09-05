CREATE TABLE public.vcr_lesson_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  content_type text NOT NULL,
  unit integer NOT NULL,
  reference jsonb,
  data jsonb NOT NULL DEFAULT '{"strokes": []}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, content_type, unit)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vcr_lesson_annotations TO authenticated;
GRANT ALL ON public.vcr_lesson_annotations TO service_role;

ALTER TABLE public.vcr_lesson_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student can view own lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Staff can view lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'examiner')
);

CREATE POLICY "Staff can save lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'examiner')
);

CREATE POLICY "Staff can update lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'examiner')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'examiner')
);

CREATE POLICY "Admins can delete lesson annotations"
ON public.vcr_lesson_annotations AS PERMISSIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_vcr_lesson_annotations_updated_at
BEFORE UPDATE ON public.vcr_lesson_annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();