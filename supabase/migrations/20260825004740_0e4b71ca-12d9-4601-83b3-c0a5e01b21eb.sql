-- 1. Profiles: remove direct read of health fields (available via get_profile_wellbeing RPC)
REVOKE SELECT (blood_group, medical_conditions, medical_notes) ON public.profiles FROM authenticated;

-- 2. Assignments: replace table-wide SELECT with a column whitelist excluding payout data
REVOKE SELECT ON public.student_teacher_assignments FROM authenticated;
GRANT SELECT (
  id, student_id, teacher_id, created_at, subject_id, student_timezone, teacher_timezone,
  status, branch_id, division_id, fee_package_id, duration_minutes, start_date,
  calculated_monthly_fee, first_month_prorated_fee, is_custom_override,
  effective_from_date, effective_to_date, status_effective_date,
  requires_schedule, requires_planning, requires_attendance,
  parent_assignment_id, transfer_type, substitute_end_date, enrollment_ref,
  status_changed_at, status_changed_by, status_change_reason,
  salary_linked, is_temporary, temp_start_date, temp_end_date,
  original_teacher_id, original_assignment_id, auto_closed_at, closed_by_admin
) ON public.student_teacher_assignments TO authenticated;

GRANT ALL ON public.student_teacher_assignments TO service_role;
GRANT ALL ON public.profiles TO service_role;