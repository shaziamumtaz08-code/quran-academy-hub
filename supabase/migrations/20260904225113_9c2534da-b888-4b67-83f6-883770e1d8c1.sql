-- 1) Personal folders for My Resources
CREATE TABLE IF NOT EXISTS public.user_resource_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.user_resource_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resource_folders TO authenticated;
GRANT ALL ON public.user_resource_folders TO service_role;

ALTER TABLE public.user_resource_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their resource folders"
ON public.user_resource_folders AS PERMISSIVE FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_resource_folders_user ON public.user_resource_folders(user_id);

CREATE TRIGGER trg_user_resource_folders_updated_at
BEFORE UPDATE ON public.user_resource_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Folder + provenance on My Resources entries
ALTER TABLE public.user_resources
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.user_resource_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS received_from uuid,
  ADD COLUMN IF NOT EXISTS source_submission_id uuid REFERENCES public.course_assignment_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_resources_folder ON public.user_resources(folder_id);

-- 3) Reviewed submissions (teacher's checked copy) — original submission never altered
CREATE TABLE IF NOT EXISTS public.assignment_submission_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.course_assignment_submissions(id) ON DELETE CASCADE,
  version_no integer NOT NULL DEFAULT 1,
  reviewer_id uuid NOT NULL,
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_path text,
  comment text,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, version_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submission_reviews TO authenticated;
GRANT ALL ON public.assignment_submission_reviews TO service_role;

ALTER TABLE public.assignment_submission_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage submission reviews"
ON public.assignment_submission_reviews AS PERMISSIVE FOR ALL TO authenticated
USING (
  reviewer_id = auth.uid()
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  reviewer_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "Students see their returned reviews"
ON public.assignment_submission_reviews AS PERMISSIVE FOR SELECT TO authenticated
USING (
  returned_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.course_assignment_submissions s
    WHERE s.id = assignment_submission_reviews.submission_id
      AND s.student_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission ON public.assignment_submission_reviews(submission_id);

CREATE TRIGGER trg_submission_reviews_updated_at
BEFORE UPDATE ON public.assignment_submission_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();