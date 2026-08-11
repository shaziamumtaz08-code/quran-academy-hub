CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_plan_per_assignment
  ON public.student_billing_plans (assignment_id)
  WHERE assignment_id IS NOT NULL AND lifecycle_status IN ('open','pending_closure');