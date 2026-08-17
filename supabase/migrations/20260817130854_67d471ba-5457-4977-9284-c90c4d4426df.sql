ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_sabaq_marker_type_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_sabaq_marker_type_check
  CHECK (sabaq_marker_type IS NULL OR sabaq_marker_type IN ('ayah','ruku','quarter','juz'));

ALTER FUNCTION public.library_ensure_share_token(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.fn_demo_session_generate_tokens() SET search_path = public, extensions;