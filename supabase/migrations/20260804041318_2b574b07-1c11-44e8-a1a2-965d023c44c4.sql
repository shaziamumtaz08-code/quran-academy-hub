-- Helper: cast text to uuid without raising on malformed input
CREATE OR REPLACE FUNCTION public.safe_uuid(_txt text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN _txt::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 1) policy_acceptances: no forging acceptances for other users
DROP POLICY IF EXISTS "Anyone can record an acceptance" ON public.policy_acceptances;
CREATE POLICY "Record own acceptance"
ON public.policy_acceptances
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2) leads: require a real contact point and cap field lengths
DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
CREATE POLICY "Public can submit leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND length(trim(name)) BETWEEN 2 AND 120
  AND for_whom = ANY (ARRAY['self'::text, 'child'::text, 'other'::text])
  AND status = 'new'::text
  AND (
    (email IS NOT NULL AND length(trim(email)) BETWEEN 5 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    OR (phone_whatsapp IS NOT NULL AND length(regexp_replace(phone_whatsapp, '\D', '', 'g')) BETWEEN 7 AND 15)
  )
  AND (message IS NULL OR length(message) <= 2000)
  AND (child_name IS NULL OR length(child_name) <= 120)
  AND (learning_goals IS NULL OR length(learning_goals) <= 2000)
);

-- 3) quiz_attempts: anonymous attempts only into live, open sessions
CREATE OR REPLACE FUNCTION public.quiz_session_is_open(_session_id uuid, _bank_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_sessions s
    WHERE s.id = _session_id
      AND s.status = 'live'
      AND (s.opens_at IS NULL OR s.opens_at <= now())
      AND (s.closes_at IS NULL OR s.closes_at >= now())
      AND (_bank_id IS NULL OR s.quiz_bank_id = _bank_id)
  );
$$;

REVOKE ALL ON FUNCTION public.quiz_session_is_open(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.quiz_session_is_open(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anon insert public attempts" ON public.quiz_attempts;
CREATE POLICY "Anon insert public attempts"
ON public.quiz_attempts
FOR INSERT
TO anon
WITH CHECK (
  student_id IS NULL
  AND guest_email IS NOT NULL
  AND session_id IS NOT NULL
  AND public.quiz_session_is_open(session_id, quiz_bank_id)
);

-- 4) chat-attachments: enforce <group_id>/<uploader_id>/<file> layout
DROP POLICY IF EXISTS "Chat attachments: members only read" ON storage.objects;
DROP POLICY IF EXISTS "Chat attachments: members only upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;

CREATE POLICY "Chat attachments: members only read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    is_admin(auth.uid())
    OR is_super_admin(auth.uid())
    OR user_in_chat_group(public.safe_uuid((storage.foldername(name))[1]), auth.uid())
  )
);

CREATE POLICY "Chat attachments: members only upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND user_in_chat_group(public.safe_uuid((storage.foldername(name))[1]), auth.uid())
);

CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR is_admin(auth.uid())
    OR is_super_admin(auth.uid())
  )
);