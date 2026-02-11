
-- 1. Create enums
CREATE TYPE public.branch_type AS ENUM ('online', 'onsite');
CREATE TYPE public.division_model AS ENUM ('one_to_one', 'group');

-- 2. Organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage organizations" ON public.organizations FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view organizations" ON public.organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.branch_type NOT NULL DEFAULT 'online',
  timezone TEXT DEFAULT 'Asia/Karachi',
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage branches" ON public.branches FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage branches" ON public.branches FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view branches" ON public.branches FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. Divisions table
CREATE TABLE public.divisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_type public.division_model NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage divisions" ON public.divisions FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage divisions" ON public.divisions FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view divisions" ON public.divisions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. User Context table
CREATE TABLE public.user_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id, division_id)
);

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all user context" ON public.user_context FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage user context" ON public.user_context FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own context" ON public.user_context FOR SELECT
  USING (user_id = auth.uid());

-- 6. Add update triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_divisions_updated_at BEFORE UPDATE ON public.divisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Add branch_id and division_id columns to key tables for future segregation
ALTER TABLE public.student_teacher_assignments ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.student_teacher_assignments ADD COLUMN division_id UUID REFERENCES public.divisions(id);

ALTER TABLE public.courses ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.courses ADD COLUMN division_id UUID REFERENCES public.divisions(id);

ALTER TABLE public.attendance ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.attendance ADD COLUMN division_id UUID REFERENCES public.divisions(id);

ALTER TABLE public.schedules ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.schedules ADD COLUMN division_id UUID REFERENCES public.divisions(id);

-- 8. Seed default organization, branch, and divisions
INSERT INTO public.organizations (id, name, slug, settings)
VALUES ('00000000-0000-0000-0000-000000000001', 'Al-Quran Time Academy', 'al-quran-time', '{"website": "https://alqurantime.com"}'::jsonb);

INSERT INTO public.branches (id, org_id, name, type, timezone)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Online HQ', 'online', 'Asia/Karachi');

INSERT INTO public.divisions (id, branch_id, name, model_type)
VALUES 
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '1:1 Mentorship', 'one_to_one'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Group Academy', 'group');

-- 9. Auto-assign all existing profiles to default branch + 1:1 division
INSERT INTO public.user_context (user_id, branch_id, division_id, is_default)
SELECT p.id, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', true
FROM public.profiles p
WHERE p.archived_at IS NULL
ON CONFLICT (user_id, branch_id, division_id) DO NOTHING;

-- 10. Backfill branch_id/division_id on existing records
UPDATE public.student_teacher_assignments 
SET branch_id = '00000000-0000-0000-0000-000000000002', 
    division_id = '00000000-0000-0000-0000-000000000003'
WHERE branch_id IS NULL;

UPDATE public.courses 
SET branch_id = '00000000-0000-0000-0000-000000000002', 
    division_id = '00000000-0000-0000-0000-000000000004'
WHERE branch_id IS NULL;

UPDATE public.attendance 
SET branch_id = '00000000-0000-0000-0000-000000000002'
WHERE branch_id IS NULL;

UPDATE public.schedules 
SET branch_id = '00000000-0000-0000-0000-000000000002'
WHERE branch_id IS NULL;

-- 11. Create helper function to get user's active division/branch
CREATE OR REPLACE FUNCTION public.get_user_default_context(_user_id UUID)
RETURNS TABLE(branch_id UUID, division_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT uc.branch_id, uc.division_id 
  FROM user_context uc 
  WHERE uc.user_id = _user_id AND uc.is_default = true 
  LIMIT 1
$$;

-- 12. Indexes for performance
CREATE INDEX idx_branches_org_id ON public.branches(org_id);
CREATE INDEX idx_divisions_branch_id ON public.divisions(branch_id);
CREATE INDEX idx_user_context_user_id ON public.user_context(user_id);
CREATE INDEX idx_user_context_branch_div ON public.user_context(branch_id, division_id);
CREATE INDEX idx_assignments_branch ON public.student_teacher_assignments(branch_id);
CREATE INDEX idx_assignments_division ON public.student_teacher_assignments(division_id);
CREATE INDEX idx_courses_branch ON public.courses(branch_id);
CREATE INDEX idx_courses_division ON public.courses(division_id);
CREATE INDEX idx_attendance_branch ON public.attendance(branch_id);
CREATE INDEX idx_schedules_branch ON public.schedules(branch_id);
