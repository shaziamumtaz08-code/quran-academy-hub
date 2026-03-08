

# Fix Paused Student Invoice Leak + Reactivation Proration

## Problems Found

### 1. Invoice still generated for paused students without `assignment_id` on billing plan
**Root cause**: In `Payments.tsx` line 628-639, the fallback query for plans without `assignment_id` only fetches `active` assignments. If ALL of a student's assignments are paused, `studentAssignmentMap` returns nothing, so `assign` is `null`. Line 647 checks `assign?.status === 'paused'` which evaluates to `undefined !== 'paused'` -- the plan passes through and generates a full-month invoice.

**Fix**: When `assign` is null but the student has paused assignments, skip the invoice. Change the logic to: if no assignment is resolved (null), also check if the student has ANY paused assignments and skip. Simpler approach: also fetch paused assignments in the fallback query, so the status check on line 647 can catch them.

### 2. Reactivation doesn't update `effective_from_date`
**Root cause**: In `Assignments.tsx` line 288-311, when status changes to `active` (reactivation from paused), only `status` and `status_effective_date` are updated. The `effective_from_date` is NOT updated to the reactivation date. This means when the student is reactivated, billing still uses the original start date instead of prorating from the reactivation date.

**Fix**: When status changes TO `active` (reactivation), set `effective_from_date = effectiveDate` so billing prorates from the reactivation day.

### 3. Billing plans without `assignment_id` need broader fallback
For students like Areeba Afzaal and Muhammad Ammar, if their billing plans lack `assignment_id`, the system must check ALL assignments (including paused) to determine if invoicing should be blocked.

---

## Technical Changes

### A. `src/pages/Payments.tsx` -- Fix fallback query to catch paused students

Change the fallback query (lines 632-635) from filtering only `active` to fetching both `active` and `paused`:
```typescript
.in('status', ['active', 'paused']);
```
This ensures `assign` is populated for paused students, and line 647's `assign?.status === 'paused'` check correctly blocks invoice generation.

### B. `src/pages/Assignments.tsx` -- Update `effective_from_date` on reactivation

In `updateStatusMutation` (lines 288-311), add logic: when the new status is `active` and an effective date is provided, also update `effective_from_date` to that date. This ensures billing prorates from the reactivation date.

```typescript
if (status === 'active' && effectiveDate) {
  updatePayload.effective_from_date = effectiveDate;
}
```

Also update the dialog description (line 971-972) to explain the reactivation date purpose when activating.

### C. `src/pages/Assignments.tsx` -- Dialog label clarity

Update the status change dialog description to mention that for reactivation, the effective date will be used as the new billing start date.

---

## Summary

| Issue | Fix |
|---|---|
| Plans without `assignment_id` skip paused check | Fetch paused assignments in fallback query |
| Reactivation doesn't reset billing start date | Set `effective_from_date` on reactivation |
| Areeba & Ammar still getting invoices | Both fixes above resolve this |

No database migrations needed -- all changes are code-level.

