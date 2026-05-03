DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses"
ON public.courses
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage course_modules" ON public.course_modules;
CREATE POLICY "Admins can manage course_modules"
ON public.course_modules
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage course_lessons" ON public.course_lessons;
CREATE POLICY "Admins can manage course_lessons"
ON public.course_lessons
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage course enrollments" ON public.course_enrollments;
CREATE POLICY "Admins can manage course enrollments"
ON public.course_enrollments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage course assets" ON public.course_assets;
CREATE POLICY "Admins can manage course assets"
ON public.course_assets
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage library assets" ON public.course_library_assets;
CREATE POLICY "Admins can manage library assets"
ON public.course_library_assets
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all posts" ON public.course_posts;
CREATE POLICY "Admins can manage all posts"
ON public.course_posts
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));