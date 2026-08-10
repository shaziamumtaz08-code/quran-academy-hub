# Cohesive Billing Lifecycle: Assignment → Plan → Invoice → Close-out

## What is actually broken (verified in the database)

- **80 of 81 active billing plans have no `assignment_id`.** Every automatic stop rule written so far keys off the plan's assignment. With the link missing, those rules never fire. Nida's plan was the only linked one — which is why hers was the only one that reacted (and over-reacted), and everyone else's simply bills forever.
- **Issa has duplicate invoices** for Aug, Sep, Oct and Nov (two rows each month, 5,000 apiece). His first plan (created 7 Aug, start 8 Aug) was superseded by a second (start 6 Jul), but superseding only set a pointer — it never voided the old plan's unpaid invoices. So both plans' invoices coexist. He is not "double-planned": only one plan is active. The duplication is in the invoices, and in the plans list showing superseded rows alongside active ones.
- **No refund object exists.** Zero negative invoices in the system, and `invoice_adjustments` only records edits — it cannot represent money owed back.
- **Saadin and Sudaim** left on 10 Aug. Each paid 5,612.90 covering 3–31 Aug. Service used: 3–10 Aug. Their Sep–Nov invoices were voided, but the August overpayment (roughly 4,065 each) is invisible to the system.

## The model to implement

**One assignment = one active plan. Unlimited plans per student (one per class).** A plan with no assignment is invalid.

```text
assignment (active/paused/left/completed)
    └── billing plan (exactly one active at a time; older ones superseded)
            └── invoices (one per billing month, prorated at both ends)
                    └── close-out: refund invoice when paid > earned
```

Lifecycle rules, enforced in the database so no screen can bypass them:

1. **Creation** — a plan must carry an `assignment_id`. Creating a new plan for an assignment that already has one automatically supersedes the old plan and voids the old plan's unpaid invoices.
2. **Ending** — admins never delete a plan. Ending the assignment (status `left` / `completed`, with its effective date) is the single action; the plan closes itself. There is also an explicit "End billing plan" action with a mandatory reason for fee-only stops (e.g. scholarship) where the class continues.
3. **Final month proration** — the leaving month is charged day-by-day up to the leave date, matching how teacher payout already prorates `(rate / days_in_month) × active_days`. Saadin left 10 Aug → 8 days of August, not the whole month. Future months are voided.
4. **Refund on close-out** — when the recomputed final-month amount is less than what was already paid, the system generates a **refund invoice**: a negative-amount document linked to the original invoice, with status `pending` until an admin marks it refunded and attaches proof. It appears in the student's ledger, the parent's fee view, and a new Finance → Refunds queue.
5. **Reactivation** — if the assignment is reactivated later, a new plan is created; old closed plans stay in history, never resurrected.

## Consequence of the proration decision

Today the platform treats assignment end dates as **month-granular** for salary inclusion (leaving in June = paid for June), while the amount itself is already day-prorated. Your answer sets **billing** to day-prorate to the leave date, which matches the amount math on the salary side. I will align billing to day-level proration and leave salary inclusion untouched — nothing in payroll changes, so no historic salary sheet is disturbed.

## Data repair included

- Backfill `assignment_id` on the 80 unlinked active plans by matching student + subject + division; anything ambiguous lands in an admin "Unlinked plans" review list rather than being guessed.
- Void the superseded-plan duplicates (Issa: Aug/Sep/Oct/Nov extras), keeping the plan that is actually active.
- Recompute August for Saadin and Sudaim to 3–10 Aug and raise a refund invoice each for the difference.
- Re-examine Nida: her Nazra assignment is still active but her 2,000 plan was deactivated by the earlier over-correction. She will be restored to one active 2,000 plan linked to that assignment.

## Guardrails so this cannot drift again

- A billing lifecycle audit panel in Finance that lists, at all times: plans with no assignment, assignments with no plan, assignments ended but plan still active, and invoices billed past an assignment's end. Empty list = healthy.
- Unit tests for the close-out math (proration, refund amount, void set) in a shared `src/lib/billingWindow.ts`, mirroring `salaryWindow.ts`, so the rules live in one tested place.

## Technical notes

- Migration: `NOT NULL`-equivalent guard trigger on `student_billing_plans.assignment_id`; partial unique index on `(assignment_id) WHERE is_active`; supersede trigger that voids the predecessor's unpaid invoices.
- `auto_generate_plan_invoices` rewritten to prorate the final month against `COALESCE(effective_to_date, status_effective_date)` at day granularity instead of month, and to call a new `close_out_billing_plan(plan_id)` that emits the refund row.
- New table `fee_refunds` (or negative-amount `fee_invoices` rows flagged `is_refund`) with GRANTs and RLS: admins manage, the student and their linked parents can read their own.
- Frontend: `BillingPlansTable` filters to active plans with a History drawer; `Payments.tsx` review dialog shows close-out and refund lines distinctly; new Refunds queue page.
