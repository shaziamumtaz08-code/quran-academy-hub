CREATE OR REPLACE FUNCTION public.get_assignment_payouts(_assignment_ids uuid[])
RETURNS TABLE (assignment_id uuid, payout_amount numeric, payout_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.payout_amount, a.payout_type
  FROM public.student_teacher_assignments a
  WHERE a.id = ANY(_assignment_ids)
    AND (
      public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR a.teacher_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_assignment_payouts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_payouts(uuid[]) TO authenticated;

REVOKE SELECT (payout_amount, payout_type) ON public.student_teacher_assignments FROM authenticated, anon;