# Link every billing plan to its assignment

## What is wrong

Confirmed in the data: both of Roomana Ashraf's plans (created 15 Aug, PKR 3,000 each, both live) have **no assignment attached** (`assignment_id` is empty). The plan setup form never asks which class the plan is for and never saves the link.

Because of that, the audit panel groups both plans under the same "unlinked" key for the student and reports them as duplicates — even though they are correctly one plan per class. The same gap also makes the "unbilled assignments" count guesswork, since unlinked plans have to be credited to an arbitrary assignment.

## The rule going forward

One active assignment (student + teacher + subject/class) = exactly one live billing plan, and the plan carries that assignment's ID. Assignment comes first, plan second.

## What to build

1. **Assignment picker in the plan setup form** (Payments → Fee Plans → Set Up Plan)
   - When a single student is selected, show their active assignments (teacher · subject · start date) and require one to be chosen.
   - The plan is saved with that assignment attached.
   - Block choosing an assignment that already has a live plan, with a clear message pointing to the existing plan.
   - Students with exactly one active assignment get it preselected, so nothing extra to click in the common case.
   - Bulk (multi-student) creation keeps working: each student's single active assignment is auto-attached; students with more than one active assignment are skipped with a notice to set them up individually.

2. **Set Up Plan from the Unbilled dialog carries the assignment**
   - Clicking "Set Up Plan" on an unbilled row opens the form with that exact student *and* assignment prefilled and locked.

3. **Plan revision keeps the link**
   - Editing/revising a plan currently passes an empty assignment, so a revised plan loses its link. Carry the original assignment through the revision.

4. **Backfill Roomana and any other unlinked live plans**
   - Attach each live unlinked plan to the student's matching active assignment (one plan per assignment, oldest plan to oldest assignment). Roomana's two plans map to her two active Nazra assignments, which clears her duplicate flag.
   - Plans whose student has no active assignment are left alone and remain visible in the audit panel as "not linked to an assignment".

5. **Guard at the database level**
   - Add a uniqueness rule so a single assignment can never have two live plans, preventing the situation from re-appearing regardless of which screen creates the plan.

6. **Duplicate detection cleanup**
   - With links in place, duplicates are strictly "two live plans on the same assignment". Unlinked legacy plans are shown as a separate "needs linking" item rather than a red duplicate alert.

## Technical notes

- Files: `src/pages/Payments.tsx` (plan form state, `savePlanMutation`, `revise_billing_plan` call at the `_assignment_id: null` site), `src/components/finance/BillingPlansAuditPanel.tsx` (unbilled → setup handoff, duplicate grouping).
- New query: active `student_teacher_assignments` for the selected student(s) with teacher and subject names, division-scoped.
- Migration: partial unique index on `student_billing_plans (assignment_id)` where `is_active` and `lifecycle_status <> 'closed'` and `assignment_id is not null`; plus a data update backfilling `assignment_id` on live unlinked plans.
- No changes to invoice generation math — it already prefers `plan.assignment_id` and only falls back to a student lookup when it is missing.
