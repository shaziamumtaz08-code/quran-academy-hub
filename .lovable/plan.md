## Problem

Marking **Student Leave** / **Teacher Leave** from the Attendance page fails — the "Mark Attendance" button stays disabled. Root causes:

1. **`classTime` is empty** when the leave dialog opens without a specific class slot, and the form validator hard-requires it.
2. **`isScheduledDay` check** blocks leave on any non-scheduled day — but leave is by nature a day-off, not a class slot.
3. **The "Leave From / Leave To" range is cosmetic.** Only the start date is persisted; the rest of the range is dropped.

The user clarified: leave is **not** a reschedule. The scheduled time should just **auto-fill from the student's schedule** when one exists for that day, and otherwise gracefully stay blank — never block the submit.

## Fix

### 1. Auto-fetch `classTime` from the student's schedule (`UnifiedAttendanceForm.tsx`)

When the dialog opens (or `classDate` / `student.id` changes) and `classTime` is empty:
- Query `schedules` for the student on the weekday of `classDate` (lowercase day string, scoped to active assignment if available).
- If exactly one slot matches → prefill `classTime` from it.
- If multiple slots match → prefill the earliest, leave the field editable.
- If none match → leave `classTime` empty (no error).

This benefits **all** statuses, not just leave — the "Scheduled Time" field will rarely be blank again.

### 2. Relax validation for leave statuses

In `isFormValid`, when `selectedStatus` is `student_leave` or `teacher_leave`:
- Skip the `classTime` requirement (fallback to `'00:00'` on submit if still empty).
- Skip the `isScheduledDay` check (leave can cover any day, including weekends/off-days).
- Keep `classDate`, `reasonCategory`, and (if `other`) `reasonText` required.

Other statuses keep their current strict validation.

### 3. Persist the leave date range as multiple rows

On submit, when status is a leave status and `leaveEndDate > classDate`:
- Expand `classDate` → `leaveEndDate` into individual dates (cap 31 days for safety).
- For each date, re-run the schedule lookup so each row gets the correct slot time (fallback `'00:00'`).
- Skip dates that already have an attendance row for that student.
- Insert one `attendance` row per date with the same `status`, `reason`, `reason_category`, `reason_text`, `voice_note_url`, `reason` (remarks).
- Toast: *"Recorded leave for N days (X inserted, Y already existed)"*.
- Single-day leave keeps the existing single-insert path.

### 4. Minor UX polish

- Hide the "Duration (minutes)" field for leave statuses (irrelevant for a day-off).
- Hide the "not scheduled on this day" warning banner for leave statuses.
- Keep the "Scheduled Time" field visible but optional for leave (so the user can still see/override it if the auto-fetch found a slot).

## Out of scope

- No new `leave_end_date` column — multi-day leave is expanded into per-day rows so all downstream reports keep working.
- No changes to non-leave statuses' validation or submit logic.
- No backend / edge function changes, no schema migrations.

## Files touched

- `src/components/attendance/UnifiedAttendanceForm.tsx` — schedule auto-fetch effect, validation relaxation, multi-day leave insert loop, conditional rendering.

No other files.