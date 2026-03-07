

# Fix Invoice Proration + Paused Student Exclusion

## Problem Analysis

**1. Farhana Tabani Invoice Not Prorated**

Root cause identified: Her `student_billing_plans` record has `assignment_id = NULL`. The invoice generation code looks up `effective_from_date` via the billing plan's `assignment_id` -- since it's null, no assignment is found, so it defaults to full-month billing (March 1-31, full 4000).

Her assignment (id: `d71c6587...`) has `effective_from_date = 2026-03-04`, but the billing plan isn't linked to it.

**Fix:** When a billing plan has no `assignment_id`, fall back to querying `student_teacher_assignments` by `student_id` to find the relevant assignment's effective dates.

**2. Paused Students Still Get Invoices**

The legacy assignment query (line 654) explicitly includes `'paused'` in the status filter. Billing plans for paused students also have `is_active = true`, so they generate invoices too.

**Fix:** Exclude paused assignments from both paths. A paused student is frozen -- no billing, no salary, no activity.

---

## Technical Changes

### File: `src/pages/Payments.tsx` -- `generateMutation`

**A. Fix billing-plan proration fallback (lines 617-649)**

After fetching assignment data for plans that have `assignment_id`, add a second lookup for plans where `assignment_id` is null -- query `student_teacher_assignments` by `student_id` to get the effective dates. Also skip plans whose linked assignment is paused.

```typescript
// After planAssignmentMap is built, also build a student-level fallback map
const plansWithoutAssignment = (plans || []).filter(p => !p.assignment_id);
const fallbackStudentIds = plansWithoutAssignment.map(p => p.student_id);
let studentAssignmentMap: Record<string, any> = {};
if (fallbackStudentIds.length > 0) {
  const { data: studentAssigns } = await supabase.from('student_teacher_assignments')
    .select('id, student_id, effective_from_date, effective_to_date, status')
    .in('student_id', fallbackStudentIds)
    .in('status', ['active']);
  (studentAssigns || []).forEach((a: any) => {
    // Use first active assignment per student
    if (!studentAssignmentMap[a.student_id]) studentAssignmentMap[a.student_id] = a;
  });
}
```

In the plan iteration loop, when `assign` is null, fall back to `studentAssignmentMap[p.student_id]`. Also skip if the resolved assignment status is `'paused'`.

**B. Exclude paused from legacy assignments (line 654)**

Change `.in('status', ['active', 'paused', 'completed'])` to `.in('status', ['active', 'completed'])`.

**C. Data fix: Link Farhana's billing plan to her assignment**

Run an UPDATE to set `assignment_id = 'd71c6587-39c6-4163-9f2f-e45592bf5905'` on billing plan `7b1333c0-0ee4-4820-8fae-97429bb9faf1`.

### File: `src/pages/SalaryEngine.tsx`

Verify paused assignments are already excluded from salary calculations (they should be based on prior fix filtering by effective date overlap, but explicitly skip `status = 'paused'` if not already done).

---

## Summary of Paused Student Behavior

| Area | Current | After Fix |
|---|---|---|
| Invoice Generation | Included (wrong) | Excluded |
| Salary Engine | Already excluded via date overlap | Explicitly excluded |
| Schedules | Kept (frozen) | No change |
| Attendance | Not applicable | No change |
| Assignment record | Preserved | Preserved |

When a paused student resumes (status back to `active`), invoices can be generated for the resumed month with proper proration from the resume date.

