-- Extend system_logs with division/branch scoping + human label + structured diff
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS division_id uuid,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS entity_label text,
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb;

CREATE INDEX IF NOT EXISTS idx_system_logs_division_id ON public.system_logs (division_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_branch_id ON public.system_logs (branch_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity ON public.system_logs (entity_type, entity_id);

-- Refresh RLS so admins are scoped to their active division, teachers see only their own,
-- super_admin sees everything. Drop old broad policies first.
DROP POLICY IF EXISTS "Admin can view all logs" ON public.system_logs;
DROP POLICY IF EXISTS "Super admin can view all logs" ON public.system_logs;
DROP POLICY IF EXISTS "Users can insert logs for their own actions" ON public.system_logs;
DROP POLICY IF EXISTS "Super admins see all logs" ON public.system_logs;
DROP POLICY IF EXISTS "Admins see division logs" ON public.system_logs;
DROP POLICY IF EXISTS "Teachers see their own logs" ON public.system_logs;
DROP POLICY IF EXISTS "Authenticated users can insert their own logs" ON public.system_logs;

-- Super admin: everything
CREATE POLICY "Super admins see all logs"
ON public.system_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Admin: their active division's logs (or logs without a division for global events)
CREATE POLICY "Admins see division logs"
ON public.system_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  AND (
    division_id IS NULL
    OR division_id IN (
      SELECT uc.division_id FROM public.user_context uc
      WHERE uc.user_id = auth.uid() AND uc.division_id IS NOT NULL
    )
  )
);

-- Teacher: only their own actions
CREATE POLICY "Teachers see their own logs"
ON public.system_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND user_id = auth.uid()
);

-- Insert: any authenticated user can log their own action; service role bypasses RLS anyway
CREATE POLICY "Authenticated users can insert their own logs"
ON public.system_logs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);