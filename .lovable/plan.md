

## Fix Schedule Recovery and Timezone Sync

### Problem Summary

Two critical data integrity issues were found:

1. **308 out of 340 schedules have identical student and teacher times** -- timezone conversion was never applied, so a student in Toronto and teacher in Karachi both show "18:00" instead of the correct offset times.

2. **All assignment timezone fields default to hardcoded values** (`America/Toronto` for students, `Asia/Karachi` for teachers) regardless of actual user location. Users in Dubai, Chicago, Belgium, Australia all show wrong timezones.

### Root Causes

- The `student_teacher_assignments` table has column defaults: `student_timezone = 'America/Toronto'`, `teacher_timezone = 'Asia/Karachi'`
- Assignment creation (bulk import and Admin Command Center) never passes timezone values
- Profile timezones are often wrong because they rely on browser auto-detect at login, but many users were admin-created and never logged in
- The `timezone_mappings` table exists with correct city-to-timezone data but is only used at schedule creation UI, not at assignment creation

### Solution (3 Parts)

---

**Part 1: Database Fix -- Correct existing data**

Run a migration that:

- Updates `profiles.timezone` based on `city` + `country` using the `timezone_mappings` table for all profiles where the current timezone doesn't match their location
- Updates `student_teacher_assignments.student_timezone` and `teacher_timezone` by pulling the correct timezone from the linked profile (which was just corrected)
- Recalculates `schedules.teacher_local_time` for all 308 schedules where `student_local_time = teacher_local_time` using the corrected assignment timezones
- Changes column defaults on `student_teacher_assignments` to `NULL` instead of hardcoded values

---

**Part 2: Assignment creation -- Auto-resolve timezone**

- **Bulk Import Edge Function** (`bulk-import-execute/index.ts`): When creating new assignments, look up each student's and teacher's profile timezone and set `student_timezone` / `teacher_timezone` accordingly
- **Admin Command Center** (`AdminCommandCenter.tsx`): When upserting assignments, resolve timezone from the selected student/teacher profiles
- **Schedules page** (`Schedules.tsx`): Change the hardcoded default timezones (`America/Toronto`, `Asia/Karachi`) in the form state to resolve from the assignment data instead. Remove the local TIMEZONES array and use the shared one from `src/lib/timezones.ts`

---

**Part 3: Profile timezone accuracy**

- Update the profile creation flow (in `admin-create-user` edge function) to resolve timezone from city/country at user creation time
- Keep the existing browser auto-detect on login as a secondary update mechanism

---

### Technical Details

**Migration SQL** will use a PL/pgSQL function to:
1. Join `profiles` to `timezone_mappings` on `country` + `city` and update `profiles.timezone`
2. Join `student_teacher_assignments` to `profiles` and update `student_timezone` / `teacher_timezone`
3. For schedules with matching times, calculate the offset difference and update `teacher_local_time`

**Files to modify:**
- `supabase/functions/bulk-import-execute/index.ts` -- add timezone resolution on assignment insert
- `supabase/functions/admin-create-user/index.ts` -- set timezone from city/country at user creation
- `src/pages/AdminCommandCenter.tsx` -- resolve timezone on assignment upsert
- `src/pages/Schedules.tsx` -- use profile-resolved timezones instead of hardcoded defaults; use shared timezone list from `src/lib/timezones.ts`
- Database migration -- fix existing data and change column defaults

