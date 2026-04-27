## Context — answer to your first question

**Yes.** The previous unification work made both entry points (Students tab card → form, and Attendance tab → form) render the **same `UnifiedAttendanceForm` component**, which writes to the **same `attendance` table** with the same column set. The only thing that differs between the two entry points now is *how the form is launched* (preset student vs. picker). The data source, fields, validation, voice-note upload path, reschedule-history insert into `session_reschedules`, and activity log are all identical. So back-end storage is fully consolidated — only the UI access points differ.

---

## What you want to change

Today, when a 1:1 lesson is rescheduled to (say) Sunday, the teacher cannot mark attendance for Sunday because:

- The form's **Date** picker is *informational* — it auto-loads the **scheduled** time/duration for that weekday from the roster. On a non-roster day it loads nothing.
- The "Rescheduled by Teacher / Student" status today only captures **where the lesson was moved TO** (`New Date` / `New Time`) — it does **not** record the actual class that was conducted on the rescheduled day.

You want the opposite flow: **the teacher fills the form on the day the rescheduled class actually happened**, picks the real (off-roster) date, marks the status as Rescheduled by Teacher / Student, records the **original missed date** in the reschedule block, then fills lesson details normally.

Good news: for one-to-one division, the form **already allows any date** (line 222–223: `if (isOneToOne) return true;`). So the date picker isn't blocked. We only need to flip the semantic of the reschedule block and relax one input.

---

## Proposed change (minimal — one file)

**File: `src/components/attendance/UnifiedAttendanceForm.tsx`**

1. **Re-label the reschedule block** (lines 644–674) so it captures the **original date the class was supposed to happen**, not the future date it's moved to:
   - Change header from "Select new session date" → **"Original scheduled date (this lesson replaces)"**
   - Change "New Date" label → **"Original Date"**
   - Change "New Time" label → **"Original Time"**
   - Change min/max on the date picker from "today → +30 days" to **"past 30 days → today"** (so teachers pick the *missed* date, not a future one).
   - Update helper text to: *"Pick the missed scheduled day this class makes up for."*

2. **Allow lesson details on Rescheduled statuses** (line 677): change `selectedStatus === 'present'` to also include `'rescheduled'` and `'student_rescheduled'`, so Sabaq / Qaida / Hifz / Nazra / Academic fields appear (the class actually happened).

3. **Allow `hasLessonDetails` requirement to apply to rescheduled statuses too** (line 426) so Present-style lesson capture is enforced.

4. **Free up Scheduled Time + Duration** (lines 569–588) when status is Rescheduled — currently both are `readOnly disabled` and only populate from the roster for that weekday. On an off-roster day there's no roster entry, so they'd stay blank. Make them editable when `requiresReschedule(selectedStatus)` is true; keep them readOnly otherwise (preserves existing behaviour for Present/Absent/Leave).

5. **Persistence — no schema change**:
   - `class_date` already stores the actual day the class happened.
   - `reschedule_date` / `reschedule_time` columns already exist; we just store the **original** date there instead of the new one.
   - `session_reschedules` insert (line 366–382) keeps the same shape — we swap the meaning: `original_date` = value from reschedule_date input, `new_date` = `classDate`. One-line swap.
   - Update the `finalReason` string template (line 332) to read *"Make-up for missed class on {date} at {time}"* for clarity in reports.

6. **Quick-action button on Attendance page** ("Reschedule" shortcut): no code change needed — it already opens this form with `initialStatus='rescheduled'`.

---

## What stays the same

- Database schema (no migration).
- Same component, same insert into `attendance`, same `session_reschedules` audit row.
- All other statuses (Present / Absent / Leave / Holiday) behave exactly as they do today.
- Group classes are unaffected (the date-freeze still applies there per `isOneToOne` guard).
- Both Students-tab and Attendance-tab entry points inherit the change automatically (one component).

---

## After the change — teacher's workflow

1. Class was supposed to happen Tue at 6 PM, was moved to Sun.
2. On Sunday, teacher opens the form (from either tab).
3. Picks **Date = Sunday** (today).
4. Picks **Status = Rescheduled by Teacher** (or by Student).
5. A block appears: enters **Original Date = Tue** + **Original Time = 6 PM** (the missed slot).
6. Time/duration on the main form are now editable — enters the actual time the rescheduled class ran.
7. Fills lesson details (Sabaq / Qaida / Academic / Hifz / Nazra) as usual.
8. Saves.
9. Result: one `attendance` row dated Sunday with `status=rescheduled`, original slot stored in `reschedule_date/time`, lesson coverage captured, plus a `session_reschedules` audit row showing the swap.

This way: ✅ off-roster day allowed, ✅ make-up tracked, ✅ lesson progress recorded, ✅ teacher KPIs not penalised, ✅ no DB changes, ✅ ~20 lines edited in one file.

Approve and I'll apply.