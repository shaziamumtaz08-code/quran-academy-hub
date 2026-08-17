# Hide teacher payout amounts from students and parents

## The problem (confirmed)

Students and parents can read their own rows in the assignments table, and those rows include
the teacher's pay fields (`payout_amount`, `payout_type`). Row-level rules can hide rows but not
columns, so a student who queries the API directly can see what their teacher is paid — even
though no student screen displays it.

## The fix

Same pattern already used for the teacher's default payout rate:

1. Lock the two pay columns at the database level so no signed-in app user can read them directly.
2. Add a secure lookup (`get_assignment_payouts`) that returns pay amounts only to admins,
   super admins, and a teacher asking about their own assignments.
3. Update every staff screen that currently reads those columns so it goes through the secure
   lookup instead.

Student, parent and scheduling screens are untouched — none of them read the pay fields today.

## Screens to update

Assignments page, Salary Engine, Teacher Payouts, Teacher "My students" view, Assignment detail
dialog, Transfer assignment dialog, Cover management panel, Salary sheet audit panel, Financial
statements, bulk import preview/validation, plus the salary calculation helper and the
salary-regeneration backend job.

## Technical notes

- Migration: `REVOKE SELECT (payout_amount, payout_type) ON public.student_teacher_assignments FROM authenticated, anon;`
- New SECURITY DEFINER function `public.get_assignment_payouts(_assignment_ids uuid[])` returning
  `(assignment_id, payout_amount, payout_type)`, gated on `is_admin() OR is_super_admin() OR teacher_id = auth.uid()`.
- Backend jobs keep using the service role, so they are unaffected by the revoke; only the
  browser-side queries need rewiring.
- New client helper `src/lib/assignmentPayouts.ts` mirroring `src/lib/payoutRates.ts`.
- Risk: any query still selecting the columns (including `select('*')` in the assignment detail
  dialog) will error after the revoke, so each call site listed above must be converted in the
  same change.
