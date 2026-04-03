
# Holiday Management System

## Overview
Give admins the ability to mark holidays both as quick one-off actions from the Attendance page and as recurring/planned holidays from a dedicated calendar in Organization Settings.

## Database Changes

### New `holidays` table
- `id` (uuid, PK)
- `holiday_date` (date, required)
- `name` (text, e.g., "Eid ul Fitr", "Weekend Off")
- `is_recurring` (boolean, default false — for annual holidays)
- `branch_id` (uuid, nullable — null = all branches)
- `division_id` (uuid, nullable — null = all divisions)
- `created_by` (uuid)
- `created_at`, `updated_at`
- RLS: Admins/Super Admins can manage; all authenticated users can view

## Feature 1: Quick "Mark Holiday" Button (Attendance Page)
- Add a **Holiday** button alongside the existing Leave/Reschedule/Mark Attendance buttons
- Opens a dialog: pick date, enter holiday name, optional branch/division scope
- Inserts into `holidays` table
- All scheduled sessions on that date are automatically excluded from "Missing Attendance" calculations

## Feature 2: Holiday Calendar (Organization Settings)
- New **Holidays** tab in Organization Settings page
- Table/calendar view of all holidays (past and upcoming)
- Add, edit, delete holidays
- Toggle `is_recurring` for annual holidays (e.g., Eid, national days)
- Filter by branch/division

## Impact on Missing Attendance
- Update `MissingAttendanceSection` and `useMissingAttendanceCount` to fetch holidays and skip those dates
- Update `MissedAttendanceBanner` (teacher dashboard) to exclude holiday dates

### Files Modified
1. **Migration SQL** — create `holidays` table with RLS
2. **`src/pages/Attendance.tsx`** — add Holiday button + dialog
3. **`src/components/attendance/MissingAttendanceSection.tsx`** — exclude holidays from missing count
4. **`src/components/dashboard/teacher/MissedAttendanceBanner.tsx`** — exclude holidays
5. **`src/pages/OrganizationSettings.tsx`** — add Holidays tab with CRUD table
