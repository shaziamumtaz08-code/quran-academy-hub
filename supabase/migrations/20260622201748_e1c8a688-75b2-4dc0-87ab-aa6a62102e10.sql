
-- 1. courses.webhook_secret
REVOKE SELECT (webhook_secret) ON public.courses FROM anon;
REVOKE SELECT (webhook_secret) ON public.courses FROM authenticated;
CREATE OR REPLACE FUNCTION public.get_course_webhook_secret(_course_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT webhook_secret FROM public.courses
  WHERE id = _course_id
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
         OR teacher_id = auth.uid() OR public.is_course_staff(auth.uid(), id))
$$;
GRANT EXECUTE ON FUNCTION public.get_course_webhook_secret(uuid) TO authenticated;

-- 2. dm_requests
DROP POLICY IF EXISTS "Teachers manage course dm requests" ON public.dm_requests;
CREATE POLICY "Teachers manage assigned course dm requests"
ON public.dm_requests FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (
    SELECT id FROM public.courses WHERE teacher_id = auth.uid()
    UNION
    SELECT cc.course_id FROM public.course_class_staff ccs
    JOIN public.course_classes cc ON cc.id = ccs.class_id
    WHERE ccs.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND course_id IN (
    SELECT id FROM public.courses WHERE teacher_id = auth.uid()
    UNION
    SELECT cc.course_id FROM public.course_class_staff ccs
    JOIN public.course_classes cc ON cc.id = ccs.class_id
    WHERE ccs.user_id = auth.uid()
  )
);

-- 3. invoice_adjustments immutability
CREATE OR REPLACE FUNCTION public.fn_invoice_adjustments_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'invoice_adjustments rows are immutable audit records'; END;
$$;
DROP TRIGGER IF EXISTS trg_invoice_adjustments_no_update ON public.invoice_adjustments;
CREATE TRIGGER trg_invoice_adjustments_no_update
BEFORE UPDATE OR DELETE ON public.invoice_adjustments
FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_adjustments_immutable();

-- 4. minor_credentials
DROP POLICY IF EXISTS "Students can view own credentials" ON public.minor_credentials;

-- 5. notification_events
DROP POLICY IF EXISTS "Teachers view own triggered notifications" ON public.notification_events;

-- 6. profiles — drop full-row teacher SELECT; replace with safe-column view + accessors
DROP POLICY IF EXISTS "Teachers can view assigned students basic info" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view historical student profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_student_profile_for_teacher(_student_id uuid)
RETURNS TABLE(
  id uuid, full_name text, email text,
  whatsapp_number text, country text, city text, gender text,
  date_of_birth date, registration_id text, timezone text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.whatsapp_number, p.country, p.city,
         p.gender, p.date_of_birth, p.registration_id, p.timezone
  FROM public.profiles p
  WHERE p.id = _student_id
    AND EXISTS (SELECT 1 FROM public.student_teacher_assignments sta
                WHERE sta.student_id = _student_id AND sta.teacher_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.get_student_profile_for_teacher(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.student_profiles_for_teachers
WITH (security_invoker = true) AS
SELECT id, full_name, email, whatsapp_number, country, city,
       gender, date_of_birth, registration_id, timezone
FROM public.profiles;
GRANT SELECT ON public.student_profiles_for_teachers TO authenticated;

CREATE POLICY "Teachers view safe student profile fields"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND id IN (SELECT public.get_teacher_student_ids(auth.uid()))
);

REVOKE SELECT (gov_id_number, gov_id_type, gov_id_doc_url,
               bank_name, bank_account_number, bank_account_title, bank_iban,
               emergency_contact_phone, emergency_contact_name)
  ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_sensitive_profile()
RETURNS TABLE(
  gov_id_number text, gov_id_type text, gov_id_doc_url text,
  bank_name text, bank_account_number text, bank_account_title text, bank_iban text,
  emergency_contact_phone text, emergency_contact_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gov_id_number, gov_id_type, gov_id_doc_url,
         bank_name, bank_account_number, bank_account_title, bank_iban,
         emergency_contact_phone, emergency_contact_name
  FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_sensitive_profile(_user_id uuid)
RETURNS TABLE(
  gov_id_number text, gov_id_type text, gov_id_doc_url text,
  bank_name text, bank_account_number text, bank_account_title text, bank_iban text,
  emergency_contact_phone text, emergency_contact_name text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.gov_id_number, p.gov_id_type, p.gov_id_doc_url,
         p.bank_name, p.bank_account_number, p.bank_account_title, p.bank_iban,
         p.emergency_contact_phone, p.emergency_contact_name
  FROM public.profiles p WHERE p.id = _user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_sensitive_profile(uuid) TO authenticated;

-- 7. quiz_banks
DROP POLICY IF EXISTS "Anon read public quiz banks" ON public.quiz_banks;

CREATE OR REPLACE FUNCTION public.get_public_quiz_bank_safe(_quiz_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.quiz_banks%ROWTYPE; _qs jsonb;
BEGIN
  SELECT * INTO _row FROM public.quiz_banks
   WHERE id = _quiz_id AND status = 'published' AND mode = 'public';
  IF _row.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(
    (q - 'correctIndex' - 'correct_answer' - 'correct' - 'answer' - 'explanation')
  ), '[]'::jsonb) INTO _qs
  FROM jsonb_array_elements(COALESCE(_row.question_bank, '[]'::jsonb)) q;
  RETURN jsonb_build_object(
    'id', _row.id, 'name', _row.name, 'description', _row.description,
    'settings', _row.settings, 'questions', _qs
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_quiz_bank_safe(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_quiz_banks_safe()
RETURNS TABLE(id uuid, name text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, description FROM public.quiz_banks
  WHERE status = 'published' AND mode = 'public'
$$;
GRANT EXECUTE ON FUNCTION public.list_public_quiz_banks_safe() TO anon, authenticated;

-- 8. realtime.messages RLS (best-effort)
DO $outer$
BEGIN
  BEGIN EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN EXECUTE $p$CREATE POLICY "Authenticated users subscribe to own channels"
    ON realtime.messages FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL AND (topic LIKE '%' || auth.uid()::text || '%'
           OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())))$p$;
  EXCEPTION WHEN others THEN NULL; END;
END $outer$;

-- 9. storage policies
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Chat attachments: members only read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments' AND (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.chat_members cm
             WHERE cm.user_id = auth.uid()
               AND cm.group_id::text = (storage.foldername(name))[1])
));

DROP POLICY IF EXISTS "Authenticated users can view ticket attachments" ON storage.objects;
CREATE POLICY "Ticket attachments: participants only read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-attachments' AND (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR public.is_ticket_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  OR public.is_ticket_watcher(((storage.foldername(name))[1])::uuid, auth.uid())
));

DROP POLICY IF EXISTS "Authenticated users can view voice notes" ON storage.objects;
CREATE POLICY "Voice notes: owner or admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-notes' AND (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR (auth.uid())::text = (storage.foldername(name))[1]
));

DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
CREATE POLICY "Receipts: owner or admin upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR (auth.uid())::text = (storage.foldername(name))[1]
));

-- 10. SUPA public bucket listing
DROP POLICY IF EXISTS "Subject images public read" ON storage.objects;
CREATE POLICY "Subject images authenticated list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'subject-images');
