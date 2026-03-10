

## Plan: Fix Mobile Grey Gap + Teacher Name Truncation

### Root Cause
On mobile, **two fixed headers stack**: DashboardLayout's mobile header (`h-14`, z-50) and TeacherDashboard's `TeacherTopBar` (z-200). The TeacherTopBar visually covers the layout header, but both add `pt-14` padding — creating the grey gap.

### Changes

#### 1. Hide DashboardLayout's mobile header on teacher dashboard
In `DashboardLayout.tsx`, detect when the teacher dashboard is active and hide the layout's own mobile header + remove its padding contribution. This way only TeacherTopBar shows.

- Pass `activeRole` check: when `activeRole === 'teacher'` and route is `/dashboard`, add a condition to hide the DashboardLayout mobile header and remove the `pt-14` from the main content area on mobile.
- Specifically: wrap the mobile header (line 458) with a condition to not render when teacher dashboard is active.
- Change the main element's `pt-14` to be conditional: `pt-14` only when the layout header is visible, `pt-0` when teacher dashboard has its own header.

#### 2. Remove TeacherDashboard's own `pt-14` padding issue
In `TeacherDashboard.tsx` (line 144), since we're removing the layout header for teacher, the `pt-14` is correct for the TeacherTopBar offset. But also remove the outer `p-3 sm:p-4 lg:p-6` from DashboardLayout for the teacher dashboard — or make the TeacherDashboard negate it.

Simpler approach: In `DashboardLayout.tsx`, remove padding from the content wrapper when on teacher dashboard route.

#### 3. Fix teacher name truncation in TeacherTopBar
In `TeacherTopBar.tsx`, show full name instead of just first name, or use a two-line layout:
- Line 1: "Assalamu Alaikum" (smaller text)
- Line 2: Full teacher name (bold, truncate)

This uses vertical space more efficiently and prevents name cutoff.

#### 4. Update Gregorian date color
Already done in previous message — verify it's working.

### Files Modified
- `src/components/layout/DashboardLayout.tsx` — conditionally hide mobile header + padding for teacher dashboard
- `src/components/dashboard/teacher/TeacherTopBar.tsx` — two-line greeting to show full name
- `src/components/dashboard/TeacherDashboard.tsx` — minor padding adjustments if needed

