## Goal
Harden the existing Change-Type edit flow in `src/pages/Assignments.tsx` so it cannot mutate historical financial/attendance data, scope each option's fields to spec, and add row-level guards plus a History drawer.

The Change-Type selector and 3 mutation branches already exist (lines 120–443, 1208–1346). The work is finishing and tightening them — not rebuilding from scratch.

---

## 1. Re-style the Change-Type selector as 3 cards (lines 1211–1231)
Replace the small segmented buttons with 3 stacked cards, each with `DollarSign` / `Pencil` / `XCircle` icon, label, description text. Highlight selected card with `border-primary ring-2`. No layout change to the rest of the dialog.

## 2. Option A — Update Payout (lines 351–387 + 1250–1285)
- Add a salary-lock pre-check inside `updateMutation` before the UPDATE:
  ```ts
  const monthKey = newEffectiveFrom.slice(0, 7); // YYYY-MM
  const { data: blocking } = await supabase
    .from('salary_payouts')
    .select('salary_month,status')
    .eq('teacher_id', prev.teacher_id)
    .in('status', ['confirmed','paid','locked'])
    .gte('salary_month', monthKey)
    .limit(1);
  if (blocking?.length) throw new Error(`Cannot backdate — paid salary records exist from ${blocking[0].salary_month}. Choose a later date.`);
  ```
- Keep existing UPDATE (payout_amount, payout_type) + history segment write. Also persist `effective_from_date = newEffectiveFrom` on the parent row (spec says "UPDATE … SET … effective_from_date"). Past months remain protected by the lock check.
- Keep `min={today}` on the date input.

## 3. Option B — Correct Information (lines 390–419 + 1287–1325)
Re-scope per spec — drop teacher swap and date field from this branch:
- UI fields: `subject_id` (Select), `requires_schedule`, `requires_planning`, `requires_attendance` (Switches), and a `notes` textarea (writes to `status_change_reason`). Remove the teacher Select and the Effective-From date input from this branch.
- Mutation: `UPDATE student_teacher_assignments SET subject_id, requires_schedule, requires_planning, requires_attendance, status_change_reason` only. No date fields touched.
- History insert with `reason: 'Info corrected'`, `started_at: now()`, no `ended_at` close on prior row (info correction is not a teacher reassignment).

## 4. Option C — Close Assignment (lines 423–443 + 1327–1346)
- Add a `status` dropdown (`completed` | `left`) — default `completed`.
- Before saving, query pending invoices:
  ```ts
  const { data: pending } = await supabase
    .from('fee_invoices')
    .select('id,billing_month')
    .eq('assignment_id', id)
    .eq('status','pending')
    .gt('billing_month', endDate.slice(0,7));
  ```
  If `pending.length > 0`, show inline warning panel with count and a `Switch` "Void these invoices". (Pre-query when user enters endDate; debounce on change.)
- Mutation UPDATE: `status` (from dropdown), `effective_to_date`, `status_effective_date: today`, `status_change_reason: closeReason`.
- If void toggle on: `UPDATE fee_invoices SET status='voided' WHERE assignment_id=... AND status='pending' AND billing_month > endDate-month`.
- History insert: `reason: 'Assignment closed'`, `ended_at: endDate`.

## 5. Row-level UI guards (around line 1692 — edit button)
- Hide Edit button when `assignment.status === 'completed' || 'left'`; show a `Badge` "Closed on {effective_to_date}" instead.
- Compute a `lockedTeacherMonths` map from a new query in `useQuery`:
  ```ts
  supabase.from('salary_payouts')
    .select('teacher_id,salary_month').eq('status','locked')
  ```
  If the assignment's teacher has any locked month, render a `Lock` icon next to the row with a `Tooltip` "Salary locked for {month}".

## 6. History drawer
Add a new component `src/components/assignments/AssignmentHistoryDrawer.tsx`:
- `Sheet side="right"` titled "Assignment History".
- Loads `assignment_history` rows for `assignment_id`, ordered by `started_at desc`.
- Renders a vertical timeline: left rail with colored dot per row, right side shows `started_at → ended_at` (or "Ongoing"), `reason`, teacher/subject snapshot.
- Trigger: a small `History` icon `Button` placed next to Edit in the assignment row actions. Hold open state via `[historyAssignment, setHistoryAssignment]` in Assignments.tsx.

## 7. Out of scope
- No schema migrations (`assignment_history`, `salary_payouts`, `fee_invoices` already exist with required columns).
- No RLS changes.
- Create-Assignment branch untouched.

## Files
- Edit: `src/pages/Assignments.tsx`
- New: `src/components/assignments/AssignmentHistoryDrawer.tsx`
