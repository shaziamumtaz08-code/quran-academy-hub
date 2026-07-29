-- 1. Lead timezone
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS timezone text;

-- 2. Trial teacher fields on demo_sessions
ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS teacher_kind text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS teacher_name text,
  ADD COLUMN IF NOT EXISTS teacher_email text,
  ADD COLUMN IF NOT EXISTS teacher_phone text,
  ADD COLUMN IF NOT EXISTS teacher_timezone text,
  ADD COLUMN IF NOT EXISTS teacher_gender text,
  ADD COLUMN IF NOT EXISTS teacher_subjects text[],
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_disabled_reason text;

-- 3. Demo messages
CREATE TABLE IF NOT EXISTS public.demo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('teacher','student','admin')),
  sender_label text NOT NULL,
  body text NOT NULL,
  raw_body text,
  is_flagged boolean NOT NULL DEFAULT false,
  flag_reasons text[],
  admin_reviewed_at timestamptz,
  admin_reviewed_by uuid,
  read_by_teacher_at timestamptz,
  read_by_student_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_messages_session ON public.demo_messages(demo_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_messages_flagged ON public.demo_messages(is_flagged) WHERE is_flagged;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_messages TO authenticated;
GRANT ALL ON public.demo_messages TO service_role;

ALTER TABLE public.demo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage demo messages"
  ON public.demo_messages AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Assigned teacher reads own demo messages"
  ON public.demo_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.id = demo_messages.demo_session_id AND ds.teacher_id = auth.uid()
  ));

CREATE TRIGGER trg_demo_messages_updated_at
  BEFORE UPDATE ON public.demo_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Content guard: mask contact details, flag risky content
CREATE OR REPLACE FUNCTION public.demo_chat_guard(_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _clean text := _text;
  _reasons text[] := '{}';
  _lower text := lower(_text);
  _kw text;
BEGIN
  -- emails
  IF _clean ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' THEN
    _reasons := _reasons || 'email';
    _clean := regexp_replace(_clean, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[hidden]', 'g');
  END IF;
  -- urls
  IF _clean ~* '(https?://|www\.|wa\.me|t\.me)' THEN
    _reasons := _reasons || 'link';
    _clean := regexp_replace(_clean, '(https?://\S+|www\.\S+|wa\.me/\S+|t\.me/\S+)', '[hidden]', 'gi');
  END IF;
  -- digit runs of 7+ (phone numbers), tolerating spaces/dashes/plus
  IF _clean ~ '(\+?\d[\d\s().-]{6,}\d)' THEN
    _reasons := _reasons || 'phone';
    _clean := regexp_replace(_clean, '(\+?\d[\d\s().-]{6,}\d)', '[hidden]', 'g');
  END IF;

  FOREACH _kw IN ARRAY ARRAY['whatsapp','telegram','snapchat','instagram','imo','skype me','fee','fees','discount','price','payment','paypal','bank account','easypaisa','jazzcash'] LOOP
    IF position(_kw in _lower) > 0 THEN
      _reasons := _reasons || _kw;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'clean', _clean,
    'flagged', array_length(_reasons, 1) IS NOT NULL,
    'reasons', to_jsonb(COALESCE(_reasons, '{}'::text[]))
  );
END;
$$;

-- 5. Is chat open for a session?
CREATE OR REPLACE FUNCTION public.demo_chat_is_open(_ds public.demo_sessions)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _ds.chat_enabled
     AND _ds.cancelled_at IS NULL
     AND COALESCE(_ds.status, '') NOT IN ('cancelled','converted','closed','no_show','rejected','declined');
$$;

-- 6. Fetch chat by share token
CREATE OR REPLACE FUNCTION public.get_demo_chat(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ds public.demo_sessions%ROWTYPE;
  _audience text;
  _msgs jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;

  SELECT * INTO _ds FROM public.demo_sessions
    WHERE teacher_share_token = _token OR student_share_token = _token LIMIT 1;
  IF _ds.id IS NULL THEN RETURN NULL; END IF;

  _audience := CASE WHEN _ds.teacher_share_token = _token THEN 'teacher' ELSE 'student' END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'sender_role', m.sender_role,
    'sender_label', m.sender_label,
    'body', m.body,
    'created_at', m.created_at,
    'mine', m.sender_role = _audience
  ) ORDER BY m.created_at), '[]'::jsonb)
  INTO _msgs
  FROM public.demo_messages m
  WHERE m.demo_session_id = _ds.id;

  RETURN jsonb_build_object(
    'audience', _audience,
    'open', public.demo_chat_is_open(_ds),
    'disabled_reason', _ds.chat_disabled_reason,
    'messages', _msgs
  );
END;
$$;

-- 7. Send chat message by share token
CREATE OR REPLACE FUNCTION public.send_demo_chat(_token text, _body text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ds public.demo_sessions%ROWTYPE;
  _lead public.leads%ROWTYPE;
  _audience text;
  _label text;
  _guard jsonb;
  _recent int;
  _trimmed text;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid link');
  END IF;

  _trimmed := btrim(COALESCE(_body, ''));
  IF _trimmed = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Message is empty');
  END IF;
  IF length(_trimmed) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Message is too long (max 2000 characters)');
  END IF;

  SELECT * INTO _ds FROM public.demo_sessions
    WHERE teacher_share_token = _token OR student_share_token = _token LIMIT 1;
  IF _ds.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid link');
  END IF;

  IF NOT public.demo_chat_is_open(_ds) THEN
    RETURN jsonb_build_object('ok', false, 'error', COALESCE(_ds.chat_disabled_reason, 'This conversation is closed.'));
  END IF;

  _audience := CASE WHEN _ds.teacher_share_token = _token THEN 'teacher' ELSE 'student' END;

  SELECT count(*) INTO _recent FROM public.demo_messages
    WHERE demo_session_id = _ds.id
      AND sender_role = _audience
      AND created_at > now() - interval '1 minute';
  IF _recent >= 12 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many messages. Please wait a moment.');
  END IF;

  SELECT * INTO _lead FROM public.leads WHERE id = _ds.lead_id;

  IF _audience = 'teacher' THEN
    _label := COALESCE(
      (SELECT full_name FROM public.profiles WHERE id = _ds.teacher_id),
      _ds.teacher_name,
      'Teacher'
    );
  ELSE
    _label := COALESCE(_lead.child_name, _lead.name, 'Student');
  END IF;

  _guard := public.demo_chat_guard(_trimmed);

  INSERT INTO public.demo_messages (
    demo_session_id, sender_role, sender_label, body, raw_body, is_flagged, flag_reasons
  ) VALUES (
    _ds.id,
    _audience,
    _label,
    _guard->>'clean',
    _trimmed,
    (_guard->>'flagged')::boolean,
    ARRAY(SELECT jsonb_array_elements_text(_guard->'reasons'))
  );

  -- Notify the LMS-side teacher when the student writes
  IF _audience = 'student' AND _ds.teacher_id IS NOT NULL THEN
    INSERT INTO public.notification_queue (
      recipient_id, recipient_type, notification_type, title, message, status, metadata
    ) VALUES (
      _ds.teacher_id, 'user', 'demo_chat_message',
      'New demo message',
      _label || ' sent you a message about the upcoming demo class.',
      'pending',
      jsonb_build_object('demo_session_id', _ds.id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_demo_chat(text) FROM public;
REVOKE ALL ON FUNCTION public.send_demo_chat(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_demo_chat(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_demo_chat(text, text) TO anon, authenticated;

-- 8. Extend the demo link payload with trial-teacher info + chat state
CREATE OR REPLACE FUNCTION public.get_demo_by_share_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

  _teacher_name := COALESCE(_teacher_name, _ds.teacher_name);

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
      'timezone', CASE WHEN _audience = 'teacher'
                       THEN COALESCE(_ds.teacher_timezone, _ds.timezone)
                       ELSE COALESCE(_lead.timezone, _ds.timezone) END,
      'platform', _ds.platform,
      'meeting_link', _ds.meeting_link,
      'status', _ds.status,
      'cancelled_at', _ds.cancelled_at,
      'chat_open', public.demo_chat_is_open(_ds),
      'chat_disabled_reason', _ds.chat_disabled_reason
    ),
    'teacher', CASE WHEN _ds.teacher_id IS NULL AND _ds.teacher_name IS NULL THEN NULL ELSE
      jsonb_build_object(
        'id', _ds.teacher_id,
        'name', COALESCE(_teacher_name, 'Your teacher'),
        'photo', _teacher_photo,
        'kind', _ds.teacher_kind
      )
    END,
    'student', CASE WHEN _audience = 'teacher' THEN
      jsonb_build_object(
        'name', COALESCE(_lead.child_name, _lead.name),
        'parent_name', CASE WHEN _lead.child_name IS NOT NULL THEN _lead.name ELSE NULL END,
        'age', _lead.child_age,
        'country', _lead.country,
        'city', _lead.city,
        'email', CASE WHEN _ds.teacher_kind = 'trial' THEN NULL ELSE _lead.email END,
        'phone', CASE WHEN _ds.teacher_kind = 'trial' THEN NULL ELSE _lead.phone_whatsapp END,
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