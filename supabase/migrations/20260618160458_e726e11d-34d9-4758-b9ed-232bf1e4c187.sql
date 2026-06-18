
-- 1) Extend demo_sessions
ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS teacher_share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS student_share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS share_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2) Auto-generate tokens on insert / when missing
CREATE OR REPLACE FUNCTION public.fn_demo_session_generate_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_share_token IS NULL THEN
    NEW.teacher_share_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  IF NEW.student_share_token IS NULL THEN
    NEW.student_share_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demo_session_generate_tokens ON public.demo_sessions;
CREATE TRIGGER trg_demo_session_generate_tokens
  BEFORE INSERT ON public.demo_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_demo_session_generate_tokens();

-- Backfill tokens for existing rows
UPDATE public.demo_sessions
SET teacher_share_token = COALESCE(teacher_share_token, encode(gen_random_bytes(16), 'hex')),
    student_share_token = COALESCE(student_share_token, encode(gen_random_bytes(16), 'hex'))
WHERE teacher_share_token IS NULL OR student_share_token IS NULL;

-- 3) demo_feedback table (two-sided)
CREATE TABLE IF NOT EXISTS public.demo_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('teacher','student')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  interested text CHECK (interested IN ('yes','no','maybe')),
  recommended_package text,
  student_level text,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demo_session_id, audience)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_feedback TO authenticated;
GRANT ALL ON public.demo_feedback TO service_role;

ALTER TABLE public.demo_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all demo feedback"
  ON public.demo_feedback FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teacher can view their demo feedback"
  ON public.demo_feedback FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.id = demo_feedback.demo_session_id
      AND ds.teacher_id = auth.uid()
  ));

CREATE POLICY "Admins can manage demo feedback"
  ON public.demo_feedback FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 4) Public read RPC — token is access control
CREATE OR REPLACE FUNCTION public.get_demo_by_share_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ds public.demo_sessions%ROWTYPE;
  _lead public.leads%ROWTYPE;
  _teacher_name text;
  _teacher_photo text;
  _audience text;
  _existing_feedback jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _ds FROM public.demo_sessions
    WHERE teacher_share_token = _token OR student_share_token = _token
    LIMIT 1;

  IF _ds.id IS NULL THEN RETURN NULL; END IF;

  _audience := CASE
    WHEN _ds.teacher_share_token = _token THEN 'teacher'
    ELSE 'student'
  END;

  SELECT * INTO _lead FROM public.leads WHERE id = _ds.lead_id;

  SELECT full_name, avatar_url INTO _teacher_name, _teacher_photo
    FROM public.profiles WHERE id = _ds.teacher_id;

  SELECT to_jsonb(df) INTO _existing_feedback
    FROM public.demo_feedback df
    WHERE df.demo_session_id = _ds.id AND df.audience = _audience
    LIMIT 1;

  RETURN jsonb_build_object(
    'audience', _audience,
    'demo', jsonb_build_object(
      'id', _ds.id,
      'scheduled_date', _ds.scheduled_date,
      'scheduled_time', _ds.scheduled_time,
      'duration_min', _ds.duration_min,
      'timezone', _ds.timezone,
      'platform', _ds.platform,
      'meeting_link', _ds.meeting_link,
      'status', _ds.status,
      'cancelled_at', _ds.cancelled_at
    ),
    'teacher', CASE WHEN _ds.teacher_id IS NULL THEN NULL ELSE
      jsonb_build_object('id', _ds.teacher_id, 'name', _teacher_name, 'photo', _teacher_photo)
    END,
    'student', CASE WHEN _audience = 'teacher' THEN
      jsonb_build_object(
        'name', COALESCE(_lead.child_name, _lead.name),
        'parent_name', CASE WHEN _lead.child_name IS NOT NULL THEN _lead.name ELSE NULL END,
        'age', _lead.child_age,
        'country', _lead.country,
        'city', _lead.city,
        'email', _lead.email,
        'phone', _lead.phone_whatsapp,
        'subject_interest', _lead.subject_interest,
        'preferred_time', _lead.preferred_time,
        'learning_goals', _lead.learning_goals,
        'current_level', _lead.current_level_specimen,
        'message', _lead.message
      )
    ELSE
      jsonb_build_object(
        'name', COALESCE(_lead.child_name, _lead.name),
        'subject_interest', _lead.subject_interest
      )
    END,
    'existing_feedback', _existing_feedback
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_demo_by_share_token(text) TO anon, authenticated;

-- 5) Public submit feedback RPC
CREATE OR REPLACE FUNCTION public.submit_demo_feedback(
  _token text,
  _rating integer DEFAULT NULL,
  _interested text DEFAULT NULL,
  _recommended_package text DEFAULT NULL,
  _student_level text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ds public.demo_sessions%ROWTYPE;
  _audience text;
  _end_ts timestamptz;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO _ds FROM public.demo_sessions
    WHERE teacher_share_token = _token OR student_share_token = _token
    LIMIT 1;

  IF _ds.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _ds.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cancelled');
  END IF;

  _audience := CASE WHEN _ds.teacher_share_token = _token THEN 'teacher' ELSE 'student' END;

  -- Feedback opens 30 min after scheduled end time
  _end_ts := ((_ds.scheduled_date::text || ' ' || _ds.scheduled_time::text)::timestamp)
             + (_ds.duration_min || ' minutes')::interval
             + interval '30 minutes';

  IF now() < _end_ts THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_early', 'opens_at', _end_ts);
  END IF;

  INSERT INTO public.demo_feedback (
    demo_session_id, lead_id, audience, rating, interested,
    recommended_package, student_level, notes
  ) VALUES (
    _ds.id, _ds.lead_id, _audience, _rating, _interested,
    _recommended_package, _student_level, _notes
  )
  ON CONFLICT (demo_session_id, audience)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    interested = EXCLUDED.interested,
    recommended_package = EXCLUDED.recommended_package,
    student_level = EXCLUDED.student_level,
    notes = EXCLUDED.notes,
    submitted_at = now();

  -- Mark the demo as done if both sides submitted (or at least one if it's the teacher)
  IF _audience = 'teacher' AND _ds.status IN ('scheduled','rescheduled') THEN
    UPDATE public.demo_sessions SET status = 'completed' WHERE id = _ds.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'audience', _audience);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_demo_feedback(text, integer, text, text, text, text) TO anon, authenticated;
