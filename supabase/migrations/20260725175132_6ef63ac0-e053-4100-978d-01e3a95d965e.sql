REVOKE SELECT ON public.courses FROM anon;
GRANT SELECT (
  id, name, teacher_id, subject_id, start_date, end_date, status, max_students,
  is_group_class, created_at, updated_at, branch_id, division_id, description,
  hero_image_url, level, outcomes, faqs, ad_creative, support_messages,
  syllabus_text, pricing, website_enabled, seo_slug, enrollment_type,
  contact_info, tags, whatsapp_channel_link, student_dm_mode,
  community_chat_enabled, thumbnail_url
) ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;