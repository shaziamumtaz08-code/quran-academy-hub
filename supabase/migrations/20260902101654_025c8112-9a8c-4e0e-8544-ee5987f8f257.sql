ALTER TABLE public.noorani_qaida_words ADD COLUMN IF NOT EXISTS audio_url text;

CREATE TABLE IF NOT EXISTS public.qaida_word_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  word_id uuid NOT NULL REFERENCES public.noorani_qaida_words(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'needs_practice',
  bookmarked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qaida_word_progress_status_check CHECK (status IN ('mastered','needs_practice')),
  CONSTRAINT qaida_word_progress_unique UNIQUE (student_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_qaida_word_progress_student ON public.qaida_word_progress(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qaida_word_progress TO authenticated;
GRANT ALL ON public.qaida_word_progress TO service_role;

ALTER TABLE public.qaida_word_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own qaida word progress"
ON public.qaida_word_progress AS PERMISSIVE FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Staff manage qaida word progress"
ON public.qaida_word_progress AS PERMISSIVE FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_academic'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_academic'::app_role)
);

CREATE POLICY "Parents view their children qaida word progress"
ON public.qaida_word_progress AS PERMISSIVE FOR SELECT TO authenticated
USING (student_id IN (SELECT public.get_parent_children_ids(auth.uid())));

CREATE TRIGGER trg_qaida_word_progress_updated_at
BEFORE UPDATE ON public.qaida_word_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();