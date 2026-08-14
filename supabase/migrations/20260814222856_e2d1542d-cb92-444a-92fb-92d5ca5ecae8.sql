DROP POLICY IF EXISTS "Authenticated users can view folders" ON public.folders;
CREATE POLICY "Authenticated users can view folders"
ON public.folders
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_view_resource_visibility(visibility, visible_to_roles, visible_to_user_ids)
);

DROP POLICY IF EXISTS "Authenticated view organization basics" ON public.organizations;
CREATE POLICY "Authenticated view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR id IN (
    SELECT uc.organization_id FROM public.user_context uc
    WHERE uc.user_id = auth.uid() AND uc.organization_id IS NOT NULL
  )
  OR NOT EXISTS (
    SELECT 1 FROM public.user_context uc
    WHERE uc.user_id = auth.uid() AND uc.organization_id IS NOT NULL
  )
);

ALTER TABLE public.family_registrations
  DROP CONSTRAINT IF EXISTS family_registrations_payload_shape_check;
ALTER TABLE public.family_registrations
  ADD CONSTRAINT family_registrations_payload_shape_check CHECK (
    (parent_name IS NULL OR char_length(parent_name) <= 150)
    AND (email IS NULL OR char_length(email) <= 254)
    AND (phone IS NULL OR char_length(phone) <= 40)
    AND (city IS NULL OR char_length(city) <= 100)
    AND (country IS NULL OR char_length(country) <= 100)
    AND (address IS NULL OR char_length(address) <= 500)
    AND (occupation IS NULL OR char_length(occupation) <= 150)
    AND (notes IS NULL OR char_length(notes) <= 2000)
    AND (student_name IS NULL OR char_length(student_name) <= 150)
    AND (source_url IS NULL OR char_length(source_url) <= 500)
    AND (children IS NULL OR (jsonb_typeof(children) = 'array' AND jsonb_array_length(children) <= 20))
    AND (applicant_data IS NULL OR (jsonb_typeof(applicant_data) = 'object' AND pg_column_size(applicant_data) <= 20000))
  ) NOT VALID;

DROP POLICY IF EXISTS "Anyone can submit a family registration" ON public.family_registrations;
CREATE POLICY "Anyone can submit a family registration"
ON public.family_registrations
FOR INSERT
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND created_profile_ids IS NULL
  AND (parent_name IS NULL OR char_length(parent_name) <= 150)
  AND (email IS NULL OR char_length(email) <= 254)
  AND (notes IS NULL OR char_length(notes) <= 2000)
  AND (children IS NULL OR (jsonb_typeof(children) = 'array' AND jsonb_array_length(children) <= 20))
  AND (applicant_data IS NULL OR (jsonb_typeof(applicant_data) = 'object' AND pg_column_size(applicant_data) <= 20000))
);