# Schedules: back-dating, bulk editing, and safe date picking

## What is wrong today

Three separate things are getting in the way when you edit a class timing.

1. **Back-dated schedule changes are blocked.** The save is refused by a rule in the
   database that says the start date must land on the same weekday as the class
   (e.g. "Start date must fall on a Monday"). Any date you pick that is not that
   weekday is rejected — which is what happens most of the time when you go back
   to an earlier date. The screen still shows the old note "Dates can only fall on
   Monday", so the two disagree with each other.
2. **The error message is confusing.** One message covers three different problems
   (missing start date, bad end date, missing reason), so when the reason box is
   empty it reads like a date problem.
3. **Bulk works only for creating.** You can add the same timing to several days at
   once, but you cannot edit several days at once — each day has to be opened and
   saved separately.

Note on existing records: of the 400 saved schedule periods, 311 already have a
start date that does not fall on the class weekday, and 399 start in the past.
So the weekday rule was never actually true of the data — it only blocks new
edits. Nothing needs to be cleaned up or rewritten; existing history stays as is.

## What will change

### 1. Back-dating works everywhere
- Remove the weekday restriction from the save rule, so any start date — past or
  future — is accepted, exactly as intended.
- Keep the sensible guards: end date cannot be before the start date, a temporary
  period must have an end date, a reason of at least 4 characters is required.
- Keep the existing behaviour where a back-dated permanent change closes off the
  earlier period the day before the new one starts, and the live weekly timing is
  refreshed only when the new period actually covers today.

### 2. Date pickers guide you to the right day
- In the edit dialog, the start and end calendars grey out every day that is not
  the class weekday, so a wrong day cannot be picked by accident. Past dates stay
  fully selectable.
- A small "Allow any date" switch sits under the calendar for the rare correction
  that must start mid-week; it is off by default.
- The same weekday-aware calendar is used anywhere else a schedule date is picked
  (temporary period end date, schedule overrides/reschedules).
- Replace the stale helper line with one that matches what the calendar does.

### 3. Clearer save errors
- Split the single "Schedule period incomplete" message into specific ones:
  missing start date, end date before start date, and reason too short — each
  pointing at the field that needs attention.

### 4. Bulk edit across days
- Add a "Edit multiple days" action on the Schedules screen: pick a student's
  assignment, tick the days that should change, set the new student time,
  duration, period type, dates and reason once, and save.
- Each ticked day is saved as its own schedule period, using its own weekday, so
  history and back-dating behave exactly like a single-day edit.
- **Shared start date snaps per day.** You pick one start date; each selected day
  stores the first occurrence of *its own* weekday on or after that date (a
  Mon/Wed/Fri edit starting Tue 8 Sep saves Wed 9, Fri 11, Mon 14). A shared end
  date snaps the other way — the last occurrence of that weekday on or before it.
  The dialog lists the resolved date next to each day before you save, so what is
  stored is never a guess.
- Conflicts are checked per day before anything is written; if one day clashes,
  it is reported by name and the rest are still saved, with a summary at the end.
- **Every per-day failure is handled the same graceful way** — a clash, a rejected
  save, or a snapped range that ends up backwards (possible when the window is
  shorter than a week, e.g. Monday's start snaps into next week while its end
  snaps into last week). Each day is attempted independently, the failure is
  listed by day name with its reason, and the remaining days still save. Days
  whose snapped range is invalid are flagged in the day list *before* you press
  save, so the usual case is caught up front rather than in the summary.


### 5. Back-dating in the middle of an existing sequence
- A back-dated change may land *between* two saved periods. The save now also
  looks forward: if a later period already starts after the new one, the new
  period is capped the day before that later period begins, instead of being left
  open-ended and overlapping it.
- Reading a schedule for any given date is unaffected either way — the resolver
  already picks the latest applicable period — but this keeps the stored history
  clean and readable.

### 6. Who can do this, and the trail it leaves
- Back-dating and bulk editing stay **admin-only**, the same rule the single-day
  save already enforces; the bulk action is hidden for anyone else.
- Every saved period already records the reason, who saved it, and when. On top of
  that, each change is written to the system activity log with the schedule, the
  old and new timing, the effective dates, whether it was back-dated, and whether
  it came from a bulk edit — so a multi-day change is traceable as one action.


## Technical notes

- `apply_schedule_period` (database function): drop the two `EXTRACT(DOW ...)`
  weekday checks for `_effective_from` / `_effective_to`. All other validation,
  the prior-period close-out, `superseded_by` link, and the live `schedules`
  refresh stay untouched. No data migration; existing `schedule_periods` rows are
  left alone.
- `src/pages/Schedules.tsx`: pass a `disabled` predicate to the two `DateCalendar`
  instances in the edit dialog driven by `newSchedule.day` plus an `allowAnyDate`
  state; split the validation branch at `handleSubmitSchedule` into field-specific
  toasts; correct the helper text at the "Dates can only fall on…" line.
- New `src/components/schedules/BulkScheduleEditDialog.tsx`: assignment picker,
  day checkboxes limited to days that already have a schedule for that assignment,
  shared time/duration/period/reason inputs, per-day `apply_schedule_period` calls
  run sequentially inside a per-day `try/catch` so a thrown validation error
  (`End date cannot be before the start date`, `Temporary timing requires a valid
  end date`, permission, conflict) is collected rather than aborting the loop;
  aggregated success/failure toast, invalidate
  `['class-schedules']` and `['schedule-periods']` afterwards.

- Reuse the existing `detectScheduleConflict` helper per day rather than adding a
  second conflict path.
- `apply_schedule_period` also gains a forward look-up: after closing the prior
  period, select the earliest period for the same schedule with
  `effective_from > _effective_from`; if found and `_effective_to` is null or
  later, cap `_effective_to` at `next.effective_from - 1`. `get_effective_schedule_periods`
  is unchanged — it already resolves by latest `effective_from`, then
  `created_at`, with temporary periods winning.
- Permission: the existing `is_admin(auth.uid()) OR is_super_admin(auth.uid())`
  guard at the top of `apply_schedule_period` stays and covers bulk edits, since
  every day goes through the same function; the bulk trigger is also gated in the
  UI by the same role check used for the edit pencil.
- Audit: insert one `system_logs` row per applied period (action
  `schedule_period_applied`), carrying `schedule_id`, `assignment_id`, day, old vs
  new time/duration, effective range, `is_backdated`, and a shared `batch_id` for
  bulk edits. Written inside the function so both single and bulk paths are
  covered.
- Bulk date snapping is computed client-side before the RPC calls (`nextDateOnWeekday`
  already exists in `Schedules.tsx`; add the mirror-image "previous occurrence"
  helper for end dates) and each resolved date is shown in the day list.

