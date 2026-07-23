-- Restore teacher access to their assigned students' profiles so attendance/students/grading pages can render names.
-- Sensitive PII (bank, gov ID, WhatsApp, DOB, emergency contact) lives in profile_sensitive_data with stricter policies;
-- this policy only grants row visibility on profiles, which contains name/subject/lesson-relevant fields.

CREATE POLICY "Teachers view assigned student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND id IN (
    SELECT sta.student_id
    FROM public.student_teacher_assignments sta
    WHERE sta.teacher_id = auth.uid()
  )
);