
-- 1. Add 'code' column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS code text;

-- 2. Add 'code' column to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code text;

-- 3. Add 'registration_id' to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_id text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_registration_id_unique ON public.profiles (registration_id) WHERE registration_id IS NOT NULL;

-- 4. Create registration_sequences table
CREATE TABLE IF NOT EXISTS public.registration_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code text NOT NULL,
  branch_code text NOT NULL,
  role_code text NOT NULL,
  next_val integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_code, branch_code, role_code)
);

ALTER TABLE public.registration_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage registration_sequences"
  ON public.registration_sequences FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view registration_sequences"
  ON public.registration_sequences FOR SELECT
  USING (is_admin(auth.uid()));

-- 5. Create the atomic ID generation function
CREATE OR REPLACE FUNCTION public.generate_registration_id(
  _org_code text,
  _branch_code text,
  _role_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
  _reg_id text;
BEGIN
  -- Upsert and atomically increment
  INSERT INTO public.registration_sequences (org_code, branch_code, role_code, next_val)
  VALUES (_org_code, _branch_code, _role_code, 1)
  ON CONFLICT (org_code, branch_code, role_code)
  DO UPDATE SET next_val = registration_sequences.next_val + 1
  RETURNING next_val INTO _next;

  -- For the first insert, next_val is already 1; for updates it's incremented
  -- But since ON CONFLICT does the +1, the first real usage after insert needs adjustment
  -- Actually the insert sets 1, conflict does +1. So first call returns 1, second returns 2. Good.

  _reg_id := _org_code || '-' || _branch_code || '-' || _role_code || '-' || lpad(_next::text, 4, '0');
  
  RETURN _reg_id;
END;
$$;
