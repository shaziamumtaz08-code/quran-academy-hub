DROP POLICY IF EXISTS "Anyone can submit a family registration" ON public.family_registrations;

CREATE POLICY "Anyone can submit a family registration"
ON public.family_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND (created_profile_ids IS NULL OR cardinality(created_profile_ids) = 0)
  AND (parent_name IS NULL OR char_length(parent_name) <= 150)
  AND (email IS NULL OR char_length(email) <= 254)
  AND (notes IS NULL OR char_length(notes) <= 2000)
  AND (children IS NULL OR (jsonb_typeof(children) = 'array' AND jsonb_array_length(children) <= 20))
  AND (applicant_data IS NULL OR (jsonb_typeof(applicant_data) = 'object' AND pg_column_size(applicant_data) <= 20000))
);

GRANT INSERT ON public.family_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_registrations TO authenticated;
GRANT ALL ON public.family_registrations TO service_role;