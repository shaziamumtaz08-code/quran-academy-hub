-- Course catalogue: column-level read access excluding webhook_secret
GRANT SELECT (id, name, teacher_id, subject_id, start_date, end_date, status, max_students,
  is_group_class, created_at, updated_at, branch_id, division_id, description, hero_image_url,
  level, outcomes, faqs, ad_creative, support_messages, syllabus_text, pricing, website_enabled,
  seo_slug, enrollment_type, contact_info, tags, whatsapp_channel_link, auto_enroll_enabled,
  student_dm_mode, community_chat_enabled, thumbnail_url, registration_type)
  ON public.courses TO anon, authenticated;
REVOKE SELECT (webhook_secret) ON public.courses FROM anon, authenticated;

-- Profiles: extend the self-update guard to all admin-controlled status columns
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.id = auth.uid() THEN
    NEW.gov_id_verified      := OLD.gov_id_verified;
    NEW.gov_id_verified_at   := OLD.gov_id_verified_at;
    NEW.gov_id_verified_by   := OLD.gov_id_verified_by;
    NEW.account_status       := OLD.account_status;
    NEW.force_password_reset := OLD.force_password_reset;
    NEW.default_payout_rate  := OLD.default_payout_rate;
    NEW.archived_at          := OLD.archived_at;
    NEW.registration_id      := OLD.registration_id;
    NEW.banking_status       := OLD.banking_status;
    NEW.cv_status            := OLD.cv_status;
    NEW.possible_duplicate_of  := OLD.possible_duplicate_of;
    NEW.duplicate_flag_reason  := OLD.duplicate_flag_reason;
    NEW.duplicate_flagged_at   := OLD.duplicate_flagged_at;
    NEW.duplicate_reviewed_at  := OLD.duplicate_reviewed_at;
    NEW.duplicate_reviewed_by  := OLD.duplicate_reviewed_by;
  END IF;

  RETURN NEW;
END;
$$;