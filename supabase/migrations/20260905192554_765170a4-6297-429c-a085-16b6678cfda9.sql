-- Close payout exposure: students/parents must not read teacher compensation columns.
-- 1) Extend the security-definer RPC to also return salary_linked (admins / own teacher only).
DROP FUNCTION IF EXISTS public.get_assignment_payouts(uuid[]);
CREATE FUNCTION public.get_assignment_payouts(_assignment_ids uuid[])
RETURNS TABLE(assignment_id uuid, payout_amount numeric, payout_type text, salary_linked boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.payout_amount, a.payout_type, a.salary_linked
  FROM public.student_teacher_assignments a
  WHERE a.id = ANY(_assignment_ids)
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR a.teacher_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_payouts(uuid[]) TO authenticated;

-- 2) Revoke direct column-level reads from app roles; RPC above remains the only read path.
REVOKE SELECT (payout_amount, payout_type, salary_linked) ON public.student_teacher_assignments FROM authenticated;
REVOKE SELECT (payout_amount, payout_type, salary_linked) ON public.student_teacher_assignments FROM anon;