
DELETE FROM public.fee_invoices fi
USING public.student_billing_plans sbp,
      public.student_teacher_assignments a
WHERE fi.plan_id = sbp.id
  AND (sbp.assignment_id = a.id
       OR (sbp.assignment_id IS NULL AND a.student_id = sbp.student_id))
  AND a.status IN ('on_hold','completed','left')
  AND fi.status = 'pending'
  AND COALESCE(fi.amount_paid, 0) = 0
  AND COALESCE(fi.is_archived, false) = false;
