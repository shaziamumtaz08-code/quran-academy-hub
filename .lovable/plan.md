
## Goal
Standardise the student/teacher assignment lifecycle around the matrix below. No history is ever dropped; "Left" archives the profile only. "Inactive" is auto-derived, never stored.

## Status Matrix (source of truth)

| Status | Source | Attendance / Planning / Exam | Invoice | Salary | History |
|---|---|---|---|---|---|
| **Active** | Default on creation | ✅ live | ✅ generate | ✅ accrue | ✅ kept |
| **Paused** | Admin pick | ❌ frozen | ✅ continues | ✅ continues | ✅ kept |
| **On Hold** | Admin pick | ❌ frozen | ❌ suspended | ❌ suspended | ✅ kept |
| **Completed** | Admin pick | ❌ frozen | ❌ final bill, no new | ✅ history retained | ✅ kept |
| **Left** | Admin pick | ❌ frozen | ❌ final bill, no new | ✅ history retained | ✅ kept + profile archived |
| **Inactive** | Auto (no assignments at all) | n/a | n/a | n/a | ✅ kept |

"Freeze" means: attendance rows, planning markers, exam entries, and Zoom join intents will NOT be generated or accepted for that assignment.

## What already exists (no rework)
- `assignment_status` enum: `active`, `paused`, `completed`, `left` ✅
- `profiles.archived_at` + global archive filtering ✅
- `StatusIndicator` already supports all colours incl. `inactive` ✅
- Salary/invoice queries identified at `SalaryEngine.tsx:196` and `Payments.tsx:1023, 962`
- Billing-plan `is_active` toggle already drives invoice generation

## Changes required

### 1. Database migration
- `ALTER TYPE assignment_status ADD VALUE 'on_hold'`
- Add to `student_teacher_assignments`: `status_changed_at`, `status_changed_by`, `status_change_reason`
- Trigger `fn_validate_assignment_status` to stamp `status_changed_at/by` on UPDATE
- Trigger `guard_assignment_delete` BEFORE DELETE — blocks if any `attendance`, `fee_invoices`, or `salary_payouts` reference this assignment/teacher pair. Forces admin to use status transitions instead.

### 2. New file `src/lib/assignmentStatusRules.ts`
Single source of truth: label, colour, and 4 booleans per status (`freezeAcademic`, `invoice`, `salary`, `scheduleVisible`) plus description. Used by every guard and dropdown.

### 3. Invoice generation guard (`Payments.tsx` ~L962)
Join `student_billing_plans` with `student_teacher_assignments` and filter `sta.status IN ('active','paused')`. On_hold/completed/left silently skipped. If any pending invoices already exist for skipped assignments, show a one-line banner: "X students have pending invoices on suspended assignments — review manually." No auto-delete.

### 4. Salary engine guard (`SalaryEngine.tsx:196`, `Payments.tsx:1023`)
Change `['active','completed']` → `['active','paused','completed']`. Excludes `on_hold` and `left`. Matches matrix.

### 5. Attendance / planning / exam freeze
Add status check at the existing entry points:
- `UnifiedAttendanceForm.tsx` — block save if assignment status ∉ `active`
- `MissingAttendanceSection.tsx` — exclude non-active assignments from "missing" list
- `MonthlyPlanning.tsx` — hide planning rows for non-active
- Exam creation in `Assignments.tsx` — same gate
All driven by `assignmentStatusRules.ts` so behaviour is uniform.

### 6. Status-change UI (smart selector + confirmation)
Replace plain status changes in:
- `Students.tsx`, `Teachers.tsx`, `Assignments.tsx`, `TransferAssignmentDialog.tsx`, `HolisticUserProfileDrawer.tsx`

Each option in dropdown shows label + 1-line description from rules file.

Confirmation modal (shadcn Dialog) required for: **On Hold**, **Completed**, **Left**. Each requires a reason text input → stored in `status_change_reason`. "Active" / "Paused" save directly with toast.

Modal copy uses the descriptions from the matrix verbatim. Left modal warns: "Profile will be archived. All history preserved. Reversible from User Management."

### 7. Cascade behaviour on save
On status set:
- **Completed / Left** → `student_billing_plans.is_active = false` for that assignment_id only (not all of student's plans)
- **Active** (resume from paused/on_hold) → `is_active = true` for that assignment's plan
- **Left** → also set `profiles.archived_at = now()` **only if the person has no other assignment in `active`/`paused`/`on_hold`**. (Multi-student teachers stay active until last assignment is gone.)
- Insert audit row in `system_logs` with `action = 'assignment_status_changed'`, from/to status, reason, names

### 8. Auto-derived "Inactive" badge (frontend only)
In `Students.tsx`, `Teachers.tsx`, `User Management`, assignment-creation dropdowns:
```ts
const isInactive = assignments.every(a => ['completed','left'].includes(a.status))
                  || assignments.length === 0
```
Render gray "Inactive — Available" badge with tooltip. Inactive users sort first in assignment-creation pickers.

### 9. Archived banner + restore
On profile drawer (`HolisticUserProfileDrawer.tsx`), if `archived_at` set show amber banner: "Archived on [date] · Reason: [last status_change_reason]" with "Restore Profile" button (sets `archived_at = null`, does NOT touch assignment statuses).

### 10. History views
Assignment history tabs (Student/Teacher drawers) show ALL past assignments with status badge per row — never hide completed/left. Already mostly there; verify.

## Out of scope (deliberately)
- Hard-deleting any historical row, anywhere
- Auto-waiving existing invoices on status change (admin reviews manually)
- Changing `user_roles.status` semantics (separate layer)
- Rewriting salary proration logic — engine just gains/loses rows from the WHERE clause

## Files touched
**New:** `src/lib/assignmentStatusRules.ts`, `src/components/assignments/StatusChangeDialog.tsx`, one migration file.
**Edited:** `Payments.tsx`, `SalaryEngine.tsx`, `Students.tsx`, `Teachers.tsx`, `Assignments.tsx`, `TransferAssignmentDialog.tsx`, `HolisticUserProfileDrawer.tsx`, `UnifiedAttendanceForm.tsx`, `MissingAttendanceSection.tsx`, `MonthlyPlanning.tsx`, `StatusIndicator.tsx` (add `on_hold` colour), `lib/activityLogger.ts` (add `assignment_status_changed` action).

## Risk notes
- Adding `paused` to salary lookups is a behaviour change but harmless: paused assignments have no attendance rows, so payout will compute as zero unless manual adjustments exist.
- Delete-guard trigger will throw on any code path that currently `DELETE`s assignments. Pre-flight scan will replace those with status transitions.
- Existing `on_hold` consumers (none today) safely fall through string checks until rules file is wired.
