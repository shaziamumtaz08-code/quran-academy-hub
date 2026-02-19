
-- Add visibility columns to resources table
ALTER TABLE public.resources 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS visible_to_roles text[];

-- Add visibility columns to folders table
ALTER TABLE public.folders 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS visible_to_roles text[];

-- Create a security definer function for visibility-based access
CREATE OR REPLACE FUNCTION public.can_view_resource_visibility(_visibility text, _visible_to_roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  -- Admins and super admins see everything
  IF is_admin(_user_id) OR is_super_admin(_user_id) THEN
    RETURN true;
  END IF;
  
  -- 'all' visibility = everyone can see
  IF _visibility = 'all' THEN
    RETURN true;
  END IF;
  
  -- Check role-based visibility
  IF _visibility = 'teachers' AND has_role(_user_id, 'teacher') THEN
    RETURN true;
  END IF;
  
  IF _visibility = 'students' AND has_role(_user_id, 'student') THEN
    RETURN true;
  END IF;
  
  IF _visibility = 'admin_only' THEN
    RETURN false; -- already handled above
  END IF;
  
  -- Custom visibility - check if user has any of the specified roles
  IF _visibility = 'custom' AND _visible_to_roles IS NOT NULL THEN
    IF has_role(_user_id, 'teacher') AND 'teacher' = ANY(_visible_to_roles) THEN
      RETURN true;
    END IF;
    IF has_role(_user_id, 'student') AND 'student' = ANY(_visible_to_roles) THEN
      RETURN true;
    END IF;
    IF has_role(_user_id, 'parent') AND 'parent' = ANY(_visible_to_roles) THEN
      RETURN true;
    END IF;
    IF has_role(_user_id, 'examiner') AND 'examiner' = ANY(_visible_to_roles) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Update the existing SELECT policies to include visibility check
-- Drop and recreate the authenticated users view policies
DROP POLICY IF EXISTS "Authenticated users can view resources" ON public.resources;
CREATE POLICY "Authenticated users can view resources"
ON public.resources
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND can_view_resource_visibility(visibility, visible_to_roles)
);

DROP POLICY IF EXISTS "Authenticated users can view folders" ON public.folders;
CREATE POLICY "Authenticated users can view folders"
ON public.folders
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND can_view_resource_visibility(visibility, visible_to_roles)
);
