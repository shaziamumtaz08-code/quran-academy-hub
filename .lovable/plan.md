## Goal
Let teachers mark each daily attendance as either a **New Lesson** or **Same Lesson Retained** (no new progress today), with a required reason when retained. Apply to Nazra first, then Hifz and academic subjects. Also make the Manzil (revision) Yes/No mandatory before saving.

## UX (inside `UnifiedAttendanceForm` when status = Present)

A new "Lesson Today" card at the top of the academic section:

```text
Lesson Today
( ● New Lesson   ○ Same as last class )

If "Same as last class":
   Reason *  [ Student didn't memorize ▾ ]
              - Student didn't memorize
              - Menstrual period (girls)
              - Student unwell / low energy
              - Teacher revised instead
              - Other → free-text
   Notes (optional)  [ ___________ ]
   → Sabaq range inputs become read-only,
     pre-filled from the previous class.

Manzil / Revision *   ( ● Yes  ○ No )   ← required, no default
```

Auto-detect badge: if the teacher enters a Sabaq range identical to the previous class's range, show an inline hint "Looks like the same lesson — switch to 'Same as last class'?" with a one-click switch.

## Validation
- `lesson_type` is required (New | Repeat).
- If `lesson_type = 'repeat'` → `repeat_reason` required.
- `manzil_done` required for Nazra/Hifz (cannot save while null).
- Save blocked with toast until all three satisfied.

## Data model
`attendance.lesson_type` already exists (text). Reuse it with values `new` | `repeat`. Add two new columns:

- `repeat_reason text` — enum-like: `not_memorized | menstrual | unwell | teacher_revised | other`
- `repeat_reason_note text` — free text when reason = other

Manzil already stored in `manzil_done boolean` — keep, just enforce non-null on save by defaulting the UI to unselected and blocking submit.

Migration adds the two columns (nullable, no backfill needed). No RLS changes.

## Scope of subjects
- **Nazra** + **Hifz**: full UI (lesson type + reason + mandatory Manzil).
- **Academic (other subjects)**: lesson type + reason only (no Manzil block). The existing `AcademicAttendanceFields` gets the same "Lesson Today" card at the top; when "Same as last class" is selected, the "Lesson/Topic Taught" field is locked and shows previous topic.

## Files to change
1. `supabase/migrations/…` — add `repeat_reason`, `repeat_reason_note` to `attendance`.
2. `src/components/attendance/UnifiedAttendanceForm.tsx`
   - new state: `lessonType`, `repeatReason`, `repeatReasonNote`
   - fetch previous class's sabaq range/topic for the same student/subject (already partially loaded as "last lesson")
   - validation guard before insert
   - pass props down + persist new columns
3. New `src/components/attendance/LessonTypeSection.tsx` — the toggle + reason UI, reused by Nazra/Hifz/Academic.
4. `src/components/attendance/NazraAttendanceFields.tsx` & `HifzAttendanceFields.tsx` — mount `LessonTypeSection` at top; pass `isRepeatLesson` to disable Sabaq inputs when repeating; enforce Manzil with no default.
5. `src/components/attendance/AcademicAttendanceFields.tsx` — mount `LessonTypeSection`; lock topic field when repeating.
6. `RecentAttendanceCards` (read-only) — show a small "Repeated" chip with reason on cards where `lesson_type='repeat'`, so parents/students can see why no progress was logged.

## Out of scope (ask later)
- Reporting/analytics aggregation of repeat-lesson counts per student/month.
- Notifying parents automatically when too many consecutive repeats occur.

Want me to include those analytics in this pass, or keep this build focused on capture + display only?