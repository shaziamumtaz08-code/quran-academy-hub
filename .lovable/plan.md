

# Data Sync Fix Across All Role Dashboards

## Issues Found

### A. Timezone bug — affects ALL 9 dashboards
`PrayerTimesWidget` uses browser-local `new Date()` to compare against prayer times that are in the user's profile timezone. If a Dubai student opens the app on a London laptop, "next prayer" and countdown are wrong. `IslamicDateCard` fetches the profile timezone but never exposes it.

### B. Student Dashboard — static schedule display, dead fallback
- Lines 50-61: `enrollments` table fallback — this table doesn't exist in the schema, silently fails
- Schedule displays static `"Monday · 14:00"` — no countdown logic like Teacher's `NextClassCountdown`
- Uses `student_local_time` correctly but doesn't compute next occurrence

### C. Parent Dashboard — missing next class & fee amount
- No "Next Class" card showing child's upcoming session
- Fee Status card shows hardcoded "Pending" instead of querying `fee_invoices`

### D. Examiner Dashboard — no user filter
- Exams query (line 29-34) fetches ALL exams system-wide, not filtered by `examiner_id`

### E. Academic Admin Dashboard — all hardcoded zeros
- No DB queries at all — stalled students, course count, teacher performance all show `0`

### F. Admissions Admin — no admissions-specific tables
- Pipeline and stats are placeholders — no tables to query. Will keep as placeholder with clear messaging.

---

## Plan (7 file edits)

### 1. IslamicDateCard — expose timezone (1 new callback)
Add `onTimezoneResolved?: (tz: string) => void` prop. Call it when timezone is fetched from profile. No visual changes.

### 2. PrayerTimesWidget — accept timezone prop
Add optional `timezone?: string` prop. Replace `new Date()` with timezone-aware current time using `Intl.DateTimeFormat` (same pattern as `getNowInTimezone` in NextClassCountdown). This fixes the bug for ALL dashboards since they all render this widget.

### 3. DashboardShell — capture & forward timezone
Capture timezone from `IslamicDateCard` via new callback, pass to `PrayerTimesWidget`. This automatically fixes Student, Parent, Admin, SuperAdmin, FeesAdmin, AdmissionsAdmin, AcademicAdmin, and Examiner dashboards.

### 4. TeacherDashboard — same timezone forwarding
Teacher renders its own layout (not DashboardShell). Capture timezone from `IslamicDateCard`, pass to `PrayerTimesWidget`.

### 5. StudentDashboard — real next class countdown
- Remove dead `enrollments` fallback (lines 50-61)
- Fetch ALL active assignments and ALL their schedules
- Reuse `buildNextOccurrence` + `useCountdown` pattern from `NextClassCountdown.tsx`
- Use `student_local_time` and student's profile timezone
- Show live countdown pills matching Teacher card pattern
- Fetch student timezone from profile for countdown calculations

### 6. ParentDashboard — add child's next class + real fee data
- For active child: fetch assignments → schedules → compute next class with `student_local_time`
- Query `fee_invoices` for each child to show actual amount due and due date instead of hardcoded "Pending"

### 7. ExaminerDashboard — filter by examiner_id
- Add `useAuth()` to get `user.id`
- Add `.eq('examiner_id', user.id)` to exams query

### 8. AcademicAdminDashboard — real DB queries
- Query `courses` table for active course count
- Query `attendance` (last 7 days) to calculate teacher lesson log rate and attendance marking rate
- Query `student_teacher_assignments` + `attendance` to find stalled students (no attendance record in 7+ days)

---

## Files to modify

| File | Change |
|------|--------|
| `IslamicDateCard.tsx` | Add `onTimezoneResolved` callback |
| `PrayerTimesWidget.tsx` | Accept `timezone` prop, use timezone-aware "now" |
| `DashboardShell.tsx` | Capture timezone, pass to PrayerTimesWidget |
| `TeacherDashboard.tsx` | Forward timezone to PrayerTimesWidget |
| `StudentDashboard.tsx` | Real countdown + remove enrollments fallback |
| `ParentDashboard.tsx` | Child next class + real fee data |
| `ExaminerDashboard.tsx` | Filter by examiner_id |
| `AcademicAdminDashboard.tsx` | Real DB queries |

No database migrations needed. No new tables.

