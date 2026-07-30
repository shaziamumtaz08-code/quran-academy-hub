GRANT SELECT (
  address, avatar_url, banking_status, bank_account_title, cv_file_name, cv_status, cv_uploaded_at, cv_url,
  date_of_birth, department, designation, emergency_contact_phone, employment_type, joining_date,
  onboarding_completed_at, qualification, specialization, whatsapp_number, years_experience,
  zoom_email, zoom_personal_id
) ON public.profiles TO authenticated;