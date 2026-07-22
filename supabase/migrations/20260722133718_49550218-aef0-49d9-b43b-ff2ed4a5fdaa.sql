
-- 1) profiles: prevent self-updates of privileged administrative columns
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_self_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_priv boolean;
BEGIN
  -- Allow service_role / admins to change privileged fields
  is_priv := public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid());
  IF is_priv THEN
    RETURN NEW;
  END IF;

  -- For everyone else, reject changes to privileged columns
  IF NEW.gov_id_verified IS DISTINCT FROM OLD.gov_id_verified
     OR NEW.gov_id_verified_by IS DISTINCT FROM OLD.gov_id_verified_by
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset
     OR NEW.default_payout_rate IS DISTINCT FROM OLD.default_payout_rate
     OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
     OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
     OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_profile_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_privileged_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_self_update();

-- 2) profiles PII overexposure: revoke column-level SELECT on sensitive columns
-- from authenticated so cross-user RLS policies can no longer leak them.
-- Callers must use the profile_sensitive_data table (owner/admin only).
REVOKE SELECT (bank_iban, bank_account_number, gov_id_number, gov_id_doc_url,
               date_of_birth, whatsapp_number, emergency_contact_phone)
ON public.profiles FROM authenticated;

REVOKE SELECT (bank_iban, bank_account_number, gov_id_number, gov_id_doc_url,
               date_of_birth, whatsapp_number, emergency_contact_phone)
ON public.profiles FROM anon;

-- Ensure self can still read own sensitive fields via profile_sensitive_data
-- (policies already exist for that table; nothing more to do here).

-- 3) course-materials storage bucket: tighten INSERT policy so teachers can
-- only upload into folders they own (own course, or a path scoped to their user_id).
DROP POLICY IF EXISTS "Teachers can upload course materials" ON storage.objects;

CREATE POLICY "Teachers can upload course materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (
    -- Path begins with a course_id the teacher staffs
    EXISTS (
      SELECT 1
      FROM public.course_class_staff ccs
      JOIN public.course_classes cc ON cc.id = ccs.class_id
      WHERE cc.course_id::text = (storage.foldername(name))[1]
        AND ccs.user_id = auth.uid()
    )
    -- Or path is scoped to their own user id (assignments/<uid>/..., announcements/<uid>/..., etc.)
    OR position(auth.uid()::text in name) > 0
  )
);
