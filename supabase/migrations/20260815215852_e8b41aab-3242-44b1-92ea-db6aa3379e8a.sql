-- 1) Backfill: attach live unlinked plans to the student's active assignments (1:1, oldest→oldest)
WITH unlinked AS (
  SELECT p.id, p.student_id,
         row_number() OVER (PARTITION BY p.student_id ORDER BY p.created_at) AS rn
  FROM public.student_billing_plans p
  WHERE p.assignment_id IS NULL
    AND p.is_active = true
    AND COALESCE(p.lifecycle_status, 'open') <> 'closed'
),
free_assign AS (
  SELECT a.id, a.student_id,
         row_number() OVER (PARTITION BY a.student_id ORDER BY a.created_at) AS rn
  FROM public.student_teacher_assignments a
  WHERE a.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.student_billing_plans p2
      WHERE p2.assignment_id = a.id
        AND p2.is_active = true
        AND COALESCE(p2.lifecycle_status, 'open') <> 'closed'
    )
)
UPDATE public.student_billing_plans sp
SET assignment_id = fa.id, updated_at = now()
FROM unlinked u
JOIN free_assign fa ON fa.student_id = u.student_id AND fa.rn = u.rn
WHERE sp.id = u.id;

-- 2) Guard: one live plan per assignment
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_plan_per_assignment
  ON public.student_billing_plans (assignment_id)
  WHERE assignment_id IS NOT NULL
    AND is_active = true
    AND COALESCE(lifecycle_status, 'open') <> 'closed';