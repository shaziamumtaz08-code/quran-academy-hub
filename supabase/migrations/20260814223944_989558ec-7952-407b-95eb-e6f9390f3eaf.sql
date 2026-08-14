CREATE TABLE IF NOT EXISTS public.attendance_lesson_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  segment_index integer NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'sabaq',
  marker_type text NOT NULL CHECK (marker_type IN ('ayah','ruku','quarter','juz')),
  surah_from text,
  ayah_from integer,
  surah_to text,
  ayah_to integer,
  juz_from integer,
  unit_from integer,
  juz_to integer,
  unit_to integer,
  display_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_lesson_segments_attendance
  ON public.attendance_lesson_segments(attendance_id, segment_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_lesson_segments TO authenticated;
GRANT ALL ON public.attendance_lesson_segments TO service_role;

ALTER TABLE public.attendance_lesson_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View segments of visible attendance"
ON public.attendance_lesson_segments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.attendance a WHERE a.id = attendance_id));

CREATE POLICY "Manage segments of manageable attendance"
ON public.attendance_lesson_segments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.id = attendance_id
    AND (a.teacher_id = auth.uid() OR a.created_by = auth.uid()
         OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.id = attendance_id
    AND (a.teacher_id = auth.uid() OR a.created_by = auth.uid()
         OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
));

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS lesson_display text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS lesson_segment_count integer;