
-- Drop the restrictive student policy on zoom_licenses
DROP POLICY IF EXISTS "Students can view zoom licenses for joining classes" ON zoom_licenses;

-- Create a new policy that lets students read any zoom license meeting_link
CREATE POLICY "Students can view zoom licenses for joining classes"
ON zoom_licenses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
);
