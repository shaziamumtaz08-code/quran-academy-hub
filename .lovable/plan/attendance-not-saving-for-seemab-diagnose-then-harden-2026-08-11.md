# Attendance not saving for Seemab — diagnose, then harden

## What the data shows

Checked before proposing anything:

- Seemab Gull is an **active teacher** with **one active assignment** — Sana Humair, subject **Arabic**, 1:1 Mentorship division. Her division context is set correctly.
- Her schedule is intact: Mon–Fri, 10:30, 30 minutes, all rows active.
- Her attendance history: 73 rows, all for Sana. Last saved row is **6 August** (entered on 7 August). Nothing since.
- Every other teacher is saving normally in the same window (Nazia, Shazia, Umme Kulsoom, Rumaisa and others all wrote rows on 10 August), so the module is not down platform-wide.
- Permissions are fine: the teacher insert policy, the Data-API grants and the Qaida reference grants all pass for her.

So there is no broken table, policy or schedule behind this. The failure is happening **inside the form for her specific case**, and the current UI cannot tell us which check is failing — which is itself the problem to fix.

## Root-cause candidate (unconfirmed until reproduced)

The Mark Attendance button is disabled by a single combined validity flag covering eleven separate conditions — missing lesson details, "Lesson Today" not chosen, a duplicate row at the same date+time, a future date, a missing reason, and more. When any one fails, the button simply greys out with **no message saying why**. A teacher in that state experiences exactly what Seemab reports: "attendance is not being marked."

Two specifics make her the likely victim:
- Her schedule slot says **10:30** but every record she has actually created is at **09:50**. The moment she corrects the time to her real slot on a date that already has a row, the duplicate check silently disables the button.
- Her subject is **Arabic**, which routes to the generic academic form where a **Lesson Topic** is mandatory for "Present" — a field that is easy to miss and, again, is not called out when empty.

I will confirm which one it is by reproducing on her account before changing behaviour.

## Plan

**1. Reproduce (first step, before any fix)**
Open her account through the existing admin impersonation route, go to Attendance, and attempt to mark today's class. Capture the exact blocked state or error.

**2. Make the block visible — the actual fix**
Replace the silent disabled button with an inline checklist directly above it: "Cannot save yet — Choose New Lesson or Same as last class", "Lesson topic is required", "A record already exists for this student at 10:30 on 11 Aug — edit it instead", etc. The button stays disabled, but the teacher always knows why and what to do. Each reason links to the field that needs attention.

**3. Fix the duplicate collision properly**
When a record already exists for that student, date and time, offer an **Edit existing record** button inside the warning instead of a dead end, so a teacher correcting a time never gets stuck.

**4. Surface save failures instead of swallowing them**
Route the save error through the shared Supabase error handler so a permission or trigger rejection shows a plain-language message rather than a raw database string, and record failed attempts so a teacher reporting "it won't save" leaves a trace we can read.

**5. Sweep for other silently-stuck teachers**
After the fix, check every teacher with an active assignment whose last attendance entry is more than five days old and confirm each is a real gap, not a blocked form. Report the list.

## Technical notes

- `src/components/attendance/UnifiedAttendanceForm.tsx`: split the `isFormValid` memo into a list of `{ ok, message, fieldId }` checks; render the failures in a small panel above the footer and keep `isFormValid` as the derived all-pass value. No change to what is considered valid — only to how it is communicated.
- Duplicate branch: pass the found row into edit mode via the existing `mode='edit'` / `existingRecord` props.
- `markAttendance.onError`: use `handleSupabaseError` from `src/lib/handleSupabaseError.ts`, plus a `system_logs` write with the student, date, time and error code.
- No database migration is required; nothing in the schema or policies is at fault.
