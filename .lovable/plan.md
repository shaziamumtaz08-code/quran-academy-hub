

# Comprehensive Pause/Freeze Feature for Student Assignments

## Problem
When a student's assignment is set to `paused`, many downstream features still include them -- attendance dropdowns, teacher student counts, dashboard timelines, live class queues, reports, schedules display, and more. Only invoicing and monthly planning currently respect the paused status (partially).

## All Touchpoints to Fix

### 1. **Teacher Dashboard** (`src/components/dashboard/TeacherDashboard.tsx`)
- Line 25: `student_teacher_assignments` query has NO status filter -- counts ALL assignments including paused
- **Fix**: Add `.eq('status', 'active')` to the assignments query

### 2. **Students Page** (`src/pages/Students.tsx`)
- Line 90: `.in('status', ['active', 'paused'])` -- shows paused students in teacher's student list
- **Fix**: Change to `.eq('status', 'active')`. Paused students should not appear in the active student card grid. Add a separate "Paused" filter/tab so teachers can see them but clearly marked as frozen and non-actionable (no attendance marking button).

### 3. **Teachers Page** (`src/pages/Teachers.tsx`)
- Line 86: `.in('status', ['active', 'paused'])` -- counts paused students in teacher's assigned student count
- **Fix**: Change to `.eq('status', 'active')` so teacher cards show only active student counts

### 4. **Attendance Page - Student Dropdown** (`src/pages/Attendance.tsx`)
- Line 230: `.eq('status', 'active')` -- already correct for teacher view
- Admin view (lines 240-254) fetches ALL students from profiles with no assignment status check
- **Fix**: For admin view, cross-reference with active assignments to exclude paused students from the mark-attendance dropdown

### 5. **Attendance - Missing Attendance Section** (`src/components/attendance/MissingAttendanceSection.tsx`)
- Lines 84, 392: Already filters `.eq('student_teacher_assignments.status', 'active')` -- **OK, no change needed**

### 6. **Live Class Queue** (`src/components/dashboard/LiveClassQueue.tsx`)
- Lines 83-101: Fetches schedules with assignments but has NO status filter on the assignment
- **Fix**: Add `.eq('student_teacher_assignments.status', 'active')` to exclude paused students from the live class queue

### 7. **Hybrid Today Timeline** (`src/components/dashboard/HybridTodayTimeline.tsx`)
- Lines 44-60: Fetches today's 1:1 schedules with inner join on assignments but no status filter
- **Fix**: Add `.eq('student_teacher_assignments.status', 'active')`

### 8. **Course Deck Carousel** (`src/components/dashboard/CourseDeckCarousel.tsx`)
- Line 47: `.eq('status', 'active')` -- already correct for teacher view
- Lines 98-105: Admin view also uses `.eq('status', 'active')` -- **OK**

### 9. **Monthly Planning** (`src/pages/MonthlyPlanning.tsx`)
- Line 202: `.eq('status', 'active')` -- already correct for teacher
- Line 248: `.eq('status', 'active')` -- already correct for admin
- Line 283: Admin subject lookup -- need to verify status filter
- **Fix**: Verify line 283 query also filters by active status. Add info banner about paused students being excluded.

### 10. **Schedules Page** (`src/pages/Schedules.tsx`)
- Line 298: `.eq('status', 'active')` -- already correct, only shows active assignments for scheduling

### 11. **Salary Engine** (`src/pages/SalaryEngine.tsx`)
- Line 117: `.in('status', ['active', 'completed'])` -- already excludes paused -- **OK**

### 12. **Payments / Invoice Generation** (`src/pages/Payments.tsx`)
- Already patched in prior messages to skip paused -- **OK**

### 13. **Student Detail Drawer** (`src/components/students/StudentDetailDrawer.tsx`)
- Line 131: Fetches assignment with no status filter
- **Fix**: Should still show data (read-only) but display a "Paused" indicator

### 14. **Report Card Generation** (`src/pages/GenerateReportCard.tsx`)
- Line 109: No status filter on assignments query
- **Fix**: Add `.eq('status', 'active')` to exclude paused students from report card generation

### 15. **Teacher Nazra Dashboard** (`src/pages/TeacherNazraDashboard.tsx`)
- Line 81: No status filter
- **Fix**: Add `.eq('status', 'active')`

### 16. **Student Past Classes** (`src/components/dashboard/StudentPastClasses.tsx`)
- Line 23: No status filter -- but this is OK as it shows historical data

### 17. **Parent Dashboard** (`src/components/dashboard/ParentDashboard.tsx`)
- Line 64: No status filter on teacher assignment lookup
- **Fix**: Add `.eq('status', 'active')` or show a "Paused" visual indicator for the child

### 18. **Division Selection Counts** (`src/pages/SelectDivision.tsx`)
- Line 95: `.eq('status', 'active')` -- already correct

### 19. **Student Card** (`src/components/students/StudentCard.tsx`)
- Lines 43-44: Already detects `isPaused` and shows status badge
- **Fix**: Disable the "Mark Attendance" button when `isPaused` is true (currently only disables for `completed`)

## Summary of Changes

| File | Current Behavior | Fix |
|---|---|---|
| `TeacherDashboard.tsx` | Counts all assignments | Filter to `active` only |
| `Students.tsx` | Shows paused students | Default to `active`, add Paused filter tab (read-only) |
| `Teachers.tsx` | Counts paused in totals | Filter to `active` only |
| `LiveClassQueue.tsx` | Shows paused in queue | Filter assignment status to `active` |
| `HybridTodayTimeline.tsx` | Shows paused in timeline | Filter assignment status to `active` |
| `StudentCard.tsx` | Allows attendance for paused | Disable attendance button for paused |
| `GenerateReportCard.tsx` | Includes paused students | Filter to `active` only |
| `TeacherNazraDashboard.tsx` | Includes paused students | Filter to `active` only |
| `ParentDashboard.tsx` | No paused indicator | Add paused visual indicator |
| `MonthlyPlanning.tsx` | Already filtered | Verify admin subject query also filtered |

All changes are query-level filters -- no database migrations needed. The principle: **paused = invisible in all operational views, preserved in data for resumption**.

