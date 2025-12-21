-- Create permissions enum for granular access control
CREATE TYPE public.permission_type AS ENUM (
  -- User management
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.assign_roles',
  
  -- Student management
  'students.view',
  'students.create',
  'students.edit',
  'students.delete',
  
  -- Teacher management
  'teachers.view',
  'teachers.create',
  'teachers.edit',
  'teachers.delete',
  
  -- Exams
  'exams.view',
  'exams.create',
  'exams.edit',
  'exams.delete',
  'exams.grade',
  
  -- Attendance
  'attendance.view',
  'attendance.mark',
  'attendance.edit',
  
  -- Schedules
  'schedules.view',
  'schedules.create',
  'schedules.edit',
  'schedules.delete',
  
  -- Reports
  'reports.view',
  'reports.generate',
  
  -- Payments/Fees
  'payments.view',
  'payments.create',
  'payments.edit',
  
  -- Settings
  'settings.view',
  'settings.edit',
  
  -- Dashboard
  'dashboard.admin',
  'dashboard.teacher',
  'dashboard.student',
  'dashboard.parent'
);

-- Create role_templates table with default permissions
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on role_templates
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage role templates
CREATE POLICY "Super admin can manage role templates"
ON public.role_templates
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- All authenticated users can view role templates
CREATE POLICY "Authenticated users can view role templates"
ON public.role_templates
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create permission_exceptions table for individual user overrides
CREATE TABLE public.permission_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  is_granted boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(user_id, permission)
);

-- Enable RLS on permission_exceptions
ALTER TABLE public.permission_exceptions ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all exceptions
CREATE POLICY "Super admin can manage permission exceptions"
ON public.permission_exceptions
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can view their own exceptions
CREATE POLICY "Users can view own permission exceptions"
ON public.permission_exceptions
FOR SELECT
USING (user_id = auth.uid());

-- Create function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  exception_granted boolean;
  role_has_permission boolean;
BEGIN
  -- Super admin has all permissions
  IF has_role(_user_id, 'super_admin') THEN
    RETURN true;
  END IF;

  -- Get the user's primary role
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Check for permission exception first (overrides role defaults)
  SELECT is_granted INTO exception_granted
  FROM permission_exceptions
  WHERE user_id = _user_id 
    AND permission = _permission
    AND (expires_at IS NULL OR expires_at > now());
  
  IF exception_granted IS NOT NULL THEN
    RETURN exception_granted;
  END IF;

  -- Check if role has this permission
  SELECT _permission = ANY(permissions) INTO role_has_permission
  FROM role_templates
  WHERE role = user_role;

  RETURN COALESCE(role_has_permission, false);
END;
$$;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- Create trigger for updated_at on role_templates
CREATE TRIGGER update_role_templates_updated_at
BEFORE UPDATE ON public.role_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing user_roles policies to allow super_admin management
DROP POLICY IF EXISTS "Admin can manage all roles" ON public.user_roles;

CREATE POLICY "Super admin can manage all roles"
ON public.user_roles
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Allow admins to view roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));