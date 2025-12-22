-- Allow authenticated users to view all user_roles for assignment purposes
CREATE POLICY "Authenticated users can view all roles for assignments"
ON public.user_roles
FOR SELECT
USING (auth.uid() IS NOT NULL);