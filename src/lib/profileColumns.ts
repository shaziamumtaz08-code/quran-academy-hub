/**
 * Columns of public.profiles that logged-in users are allowed to read.
 * Bank account number/IBAN/bank name, government ID number/document and the
 * onboarding token are intentionally excluded — they are admin-only and must be
 * fetched through the admin RPCs (admin_get_sensitive_profile / get_my_sensitive_profile).
 *
 * Never use select('*') on profiles: it fails with "permission denied for table profiles"
 * because the restricted columns above have no grant for the authenticated role.
 */
export const PROFILE_SAFE_COLUMNS = [
  'id',
  'full_name',
  'display_name',
  'email',
  'whatsapp_number',
  'avatar_url',
  'address',
  'city',
  'country',
  'country_code',
  'region',
  'nationality',
  'timezone',
  'gender',
  'age',
  // NOTE: date_of_birth is restricted — fetch it via the get_profile_wellbeing RPC
  // (self / linked parent / assigned teacher / admin only).
  'account_status',
  'archived_at',
  'registration_id',
  'created_at',
  'updated_at',
  'guardian_type',
  'father_name',
  'mother_name',
  'emergency_contact_name',
  'preferred_contact_method',
  'preferred_language',
  'first_language',
  'hear_about_us',
  'learning_goals',
  'special_needs',
  'arabic_level',
  'mushaf_type',
  'preferred_unit',
  'daily_target_amount',
  'daily_target_lines',
  'teaching_os_language',
  'meeting_link',
  'force_password_reset',
  'gov_id_type',
  'gov_id_verified',
  'gov_id_verified_at',
  'gov_id_verified_by',
  'default_payout_rate',
  // professional / employment
  'qualification',
  'specialization',
  'years_experience',
  'designation',
  'department',
  'employment_type',
  'joining_date',
  'zoom_email',
  'zoom_personal_id',
  'cv_url',
  'cv_file_name',
  'cv_status',
  'cv_uploaded_at',
  'banking_status',
  // NOTE: bank_account_title is restricted — read it from profile_sensitive_data
  // (self / admin only), never from profiles.
  'onboarding_completed_at',
  // student detail fields
  // NOTE: blood_group, medical_*, father/mother_contact and emergency_contact_phone
  // are restricted — fetch them via the get_profile_wellbeing RPC (self / parent / admin only).
  'school_name',
  'grade_level',
].join(', ');

