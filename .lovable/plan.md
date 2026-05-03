## Goal
Stop "red zone" Missing Attendance entries that exist only because the assignment was never parked (Paused / Left / Completed). Give admins one-click controls right where the problem is visible, and make sure once they park it, both past and future stale rows disappear.

## Root cause (confirmed)
`MissingAttendanceSection` already filters to `student_teacher_assignments.status = 'active'`. So any assignment correctly parked vanishes automatically. The reason rows still show up in red: those assignments are still `status = 'active'` even though the student/teacher actually stopped weeks ago. There is no fast way for the admin to park them from the attendance screen — they have to go to Assignments, find the row, change status, set an effective date.

## Changes

### 1. Inline actions on each Missing Attendance row
File: `src/components/attendance/MissingAttendanceSection.tsx`

Add a new "Action" column at the end of the table. Per row, render a small popover trigger ("Park assignment") with three buttons:
- Mark **Paused**
- Mark **Left**
- Mark **Completed**

Selecting any of them opens a confirmation dialog that requires the admin to **manually pick an effective date** (no auto-default — keeps it deliberate). Date picker uses the shadcn Calendar inside a Popover (with `pointer-events-auto`).

On confirm:
- Update `student_teacher_assignments` for that `assignment_id` (we'll resolve it from `student_id + teacher_id` in the row, or join `assignment_id` into the missing query — see Technical Notes).
- Set `status` = chosen value, `status_effective_date` = picked date, and for `left` / `completed` also set `ended_at` = picked date.
- Invalidate the missing-attendance and assignments queries.

Toast: "Assignment parked as {status} effective {date}. {N} stale rows cleared."

### 2. Retroactive suppression in the missing-attendance query
Files: `src/components/attendance/MissingAttendanceSection.tsx` (both the panel query and the `useMissingAttendanceCount` hook).

Today the query only includes `status = 'active'` assignments. Once an assignment is parked, its rows disappear — but only because we drop the whole assignment. To **also** clear the historical streak that prompted the action, the query already does the right thing (parked assignment = excluded entirely). We just need to make sure:
- We **also** include parked assignments in the candidate set, but **filter out** any expected day on/after `status_effective_date` (or `ended_at`, whichever is set).

Logic per assignment:
```
effectiveCutoff = status_effective_date ?? ended_at ?? null
include the assignment in missing analysis only if status === 'active'
   OR (status in ['paused','left','completed'] AND effectiveCutoff is set
       AND day < effectiveCutoff)
```

This way:
- Active assignments: behave as today.
- Recently parked assignments: their pre-cutoff missing dates still appear (legitimate historical gaps if any), but every date from the cutoff onward is suppressed — exactly what the admin wants when clearing the red zone.
- An admin who picks the **first missing date** as the effective date wipes the entire red streak in one click.

### 3. Small UX polish
- The badge counter on the panel header already reflects filtered count — it will drop in real time after the mutation invalidates the query.
- Disable the action buttons while the mutation is pending; show a small spinner.
- Permission gate: only show the action column to admins (`super_admin`, `admin`, `admin_academic`, `admin_division`). Teachers viewing missing for their own students don't see it.

## Technical Notes
- The current query selects `student_teacher_assignments` fields but not `id`, `status`, `status_effective_date`, `ended_at`. Add those to both the panel query and the count hook so we can carry `assignment_id` and `effectiveCutoff` per row and apply the cutoff filter client-side.
- Mutation uses `supabase.from('student_teacher_assignments').update({...}).eq('id', assignmentId)` — same shape already used in `src/pages/Assignments.tsx` (lines 297-323). No edge function needed.
- For `left`, mirror the existing Assignments page behaviour: also clear/deactivate the related `schedules` rows (`is_active = false`, `ended_at = effectiveDate`).
- No schema migration required — all needed columns already exist (`status_effective_date`, `ended_at`, `status`).

## Out of scope
- Bulk multi-select (per your answer, inline-only is enough for now).
- Auto-defaulting the effective date.
- Changes elsewhere (Assignments page, Salary, Billing) — those already handle parked statuses correctly.

## Files touched
- `src/components/attendance/MissingAttendanceSection.tsx` — new column, dialog, mutation, cutoff filter (panel + count hook).
