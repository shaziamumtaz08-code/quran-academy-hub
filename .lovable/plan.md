## Problem

The attendance entry flow currently has **two parallel systems** that conflict:

1. **Quick-action buttons** on the Attendance page: `Student Leave`, `Teacher Leave` (admin → opens a separate bulk dialog), `Reschedule`, `Mark Attendance`.
2. **The `UnifiedAttendanceForm` dropdown** which is *supposed* to be the single source of truth, but its Status dropdown **filters out `student_leave` / `teacher_leave` for non-admins** (lines 822-827).

Concrete bugs this produces:

- A teacher clicking **"Student Leave"** opens the unified form with `initialStatus='student_leave'`, but the dropdown filter strips that option, so the form silently falls back to `Present` / `Student Absent` / `Teacher Absent` / `Rescheduled by …` — exactly what your screenshot shows. The teacher ends up marking **absent**, not leave.
- For admins, the dropdown duplicates what the quick buttons already do — two ways to reach the same state.
- "Teacher Leave" opens a **completely different** component (`TeacherLeaveBulkDialog`), breaking the "one form" promise.

## Solution — One form, contextual sub-blocks

Collapse everything into the existing `UnifiedAttendanceForm` and remove the duplicate buttons. The Status dropdown becomes the single decision point; sub-fields appear inline based on the chosen status.

### 1. Fix the Status dropdown (`UnifiedAttendanceForm.tsx`)

Remove the admin-only filter on `student_leave` / `teacher_leave`. Final dropdown order shown to **everyone** (teachers + admins):

- Present
- Student Absent
- Student Leave
- Teacher Absent
- Teacher Leave
- Rescheduled by Teacher
- Rescheduled by Student
- Holiday *(admin/super_admin only — stays gated)*

### 2. Contextual sub-blocks (already partly wired, will be completed)

| Selected status | Sub-block revealed |
|---|---|
| Present | Academic Progress block (existing) |
| Student/Teacher **Absent** | Reason category + reason text (existing) |
| Student/Teacher **Leave** | Reason + **Leave From → To** date range (`leaveEndDate` already exists; surface it whenever a Leave status is selected, not only for admins) + auto-expand records across the range (existing logic at line 545) |
| Rescheduled by Teacher/Student | Full reschedule sub-form: new date, new time, reschedule reason dropdown (existing) |
| Holiday | Holiday name field (admin only) |

No new fields are added — every sub-block already exists in the form; we're just making sure each one renders for the right status regardless of role.

### 3. Simplify the Attendance page header (`src/pages/Attendance.tsx` lines 1032-1078)

Replace the row of buttons with **one primary button**:

```
[Mark Attendance ▾]
```

A small dropdown caret offers admin power-tools that don't fit a single-row flow:
- **Bulk Teacher Leave (date range, multiple teachers)** → keeps `TeacherLeaveBulkDialog` for the genuine bulk case
- **Mark Holiday** → keeps holiday dialog

Removed buttons: `Student Leave`, `Teacher Leave` (single), `Reschedule` — all now reachable by opening Mark Attendance and picking the status. `initialStatus` is no longer needed from those buttons.

### 4. Cleanup

- Drop the unused `setUnifiedInitialStatus('student_leave' | 'rescheduled')` calls.
- Keep `initialStatus` prop on the form (still used when editing or when the bulk-leave shortcut pre-selects `teacher_leave`).
- No DB / RLS / schema changes. No changes to how records are written — the existing `handleSubmit` already handles leave date ranges and reschedule inserts correctly.

### Files touched

- `src/components/attendance/UnifiedAttendanceForm.tsx` — remove the admin-only filter on Leave options (lines 822-827).
- `src/pages/Attendance.tsx` — collapse the 4 quick-action buttons into one `Mark Attendance` button + a small admin overflow menu for `Bulk Teacher Leave` and `Mark Holiday`.

### Out of scope

- No changes to attendance table, statuses enum, RLS, or reporting math.
- The `RecentAttendanceCards`, stats tiles, and `GroupAttendanceTab` are untouched — they already render `student_leave` / `teacher_leave` correctly.
