# Date-ranged schedule timeline

## Goal
Let admins define recurring class timings for a specific date range without manually restoring an old schedule afterward.

A schedule will support:
- **Permanent** timing: applies from its start date onward, until another permanent timing replaces it.
- **Temporary** timing: requires start and end dates, overrides the permanent timing only inside that window, then automatically falls back.
- **One-off reschedule**: remains the existing single-class override.
- **Leave / holiday**: remains attendance availability logic, not a schedule change.

Example:
```text
Permanent: 4:00–5:00, from 1 Sep onward
Temporary: 6:00–7:00, 1 Oct–31 Dec
Result:    Sep 4–5 | Oct–Dec 6–7 | Jan onward 4–5 automatically
```

## What will change

### 1. Add an assignment-scoped schedule timeline
- Keep existing `schedules` rows as the recurring permanent baseline for backward compatibility.
- Add an append-only schedule-period table linked to `assignment_id` and the baseline schedule, containing:
  - weekday, student and teacher local times, duration
  - `effective_from` and optional `effective_to`
  - `change_type`: permanent or temporary
  - reason, creator, timestamps, and supersession metadata
- Backfill each current active schedule as its assignment/day baseline history record.
- Preserve old periods rather than overwriting them, so prior attendance, payroll evidence, and audits retain the timing that applied then.
- Enforce lowercase weekdays, valid date windows, assignment ownership, explicit backend grants, row-level access, and assignment-scoped conflict checks.

### 2. Define deterministic precedence
For any class date, resolve exactly one recurring schedule per assignment/day:
1. A one-off `schedule_overrides` record wins for that exact occurrence.
2. A temporary period containing the date wins over the permanent baseline.
3. Otherwise, the latest permanent period whose start date is on or before the date applies.
4. Assignment start/end status, holidays, and leave rules are applied separately.

Temporary periods for the same assignment/day may not overlap. A new permanent period closes the prior permanent period the day before it starts. Temporary periods may overlap the permanent baseline because fallback is intentional.

### 3. Replace “Edit schedule” with effective-date choices
In Scheduling, editing a slot will ask:
- **Permanent change** — start date required; no end date.
- **Temporary change** — start and end dates required.
- **Only this class** — use the existing one-off reschedule flow.

The form will use interactive date pickers, require a reason, show both student and teacher timezone times, and preview what happens after expiry. Existing direct edit behavior will be removed from the UI so historical timing is never silently rewritten.

### 4. Show the timeline clearly
- Each assignment row will show the timing effective today plus “Temporary until …” or “Permanent from …”.
- Add a compact timeline/history view showing past, current, and future periods.
- Daily and monthly calendars will resolve against their selected date, not today’s generic weekday template.
- CSV exports will resolve each date in the requested range before output.
- Conflicts will be evaluated only where both weekday, time, and effective date windows overlap.

### 5. Make every schedule consumer date-aware
Use one shared resolver contract in the database and matching typed frontend helper, then update:
- attendance valid-date and automatic-time selection
- daily/monthly schedule calendars
- teacher, student, parent, and admin dashboards
- live-class/join-window and Zoom operational matching
- reminders and class pings
- planning and salary scheduled-day calculations
- schedule exports and assignment transfer schedule copying

This avoids different modules independently choosing stale schedule rows.

### 6. Verification
- Test permanent → temporary → automatic fallback across month/year boundaries.
- Test future permanent changes and temporary periods scheduled in advance.
- Test US daylight-saving dates using stored IANA timezones and both displayed local times.
- Test overlap rejection only for intersecting effective periods.
- Verify attendance offers only dates/times effective for that date.
- Verify calendar, live class, reminders, and salary/planning agree on the same resolved occurrence.
- Verify student/parent read access and admin management boundaries.

## Technical notes
- The model remains assignment-scoped; it does not attach schedule history directly to a student or teacher.
- No cron job is needed for expiry: date resolution automatically falls back after `effective_to`.
- Existing one-off `schedule_overrides` stays intact and remains higher priority for its exact date.
- Existing `schedules` IDs remain valid so current foreign references are not broken.
