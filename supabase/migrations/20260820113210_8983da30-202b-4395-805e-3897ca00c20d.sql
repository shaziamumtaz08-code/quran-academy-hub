-- 1. student_progress
ALTER TABLE public.student_progress
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mushaf',
  ADD COLUMN IF NOT EXISTS library_item_id uuid REFERENCES public.library_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.student_progress
  DROP CONSTRAINT IF EXISTS student_progress_content_type_check;
ALTER TABLE public.student_progress
  ADD CONSTRAINT student_progress_content_type_check CHECK (content_type IN ('mushaf','qaida','pdf'));

-- 2. vcr_sessions
ALTER TABLE public.vcr_sessions
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mushaf',
  ADD COLUMN IF NOT EXISTS library_item_id uuid REFERENCES public.library_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vcr_sessions
  DROP CONSTRAINT IF EXISTS vcr_sessions_content_type_check;
ALTER TABLE public.vcr_sessions
  ADD CONSTRAINT vcr_sessions_content_type_check CHECK (content_type IN ('mushaf','qaida','pdf'));

-- 3. syllabus_items
ALTER TABLE public.syllabus_items
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mushaf',
  ADD COLUMN IF NOT EXISTS library_item_id uuid REFERENCES public.library_items(id) ON DELETE SET NULL;

ALTER TABLE public.syllabus_items
  DROP CONSTRAINT IF EXISTS syllabus_items_content_type_check;
ALTER TABLE public.syllabus_items
  ADD CONSTRAINT syllabus_items_content_type_check CHECK (content_type IN ('mushaf','qaida','pdf'));

CREATE INDEX IF NOT EXISTS idx_student_progress_library_item ON public.student_progress(library_item_id);
CREATE INDEX IF NOT EXISTS idx_vcr_sessions_library_item ON public.vcr_sessions(library_item_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_library_item ON public.syllabus_items(library_item_id);

-- 4. teacher_library_pins
CREATE TABLE IF NOT EXISTS public.teacher_library_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, library_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_library_pins TO authenticated;
GRANT ALL ON public.teacher_library_pins TO service_role;

ALTER TABLE public.teacher_library_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own library pins"
ON public.teacher_library_pins
AS PERMISSIVE
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admins can view library pins"
ON public.teacher_library_pins
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_teacher_library_pins_teacher ON public.teacher_library_pins(teacher_id);