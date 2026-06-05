## Problem found
The attendance report is reading from the right table, and attendance rows do exist in the backend. The main issue is that the report filters by the active division using only `division_id = current division`, while most existing attendance rows have `division_id = null`. The main Attendance page already handles this by including both the active division and null-division records.

## Plan
1. Update `AttendanceReports` to use the same division-scoping rule as the working Attendance page:
   - when a division is active, include rows where `division_id` matches that division
   - also include legacy/shared rows where `division_id` is null
2. Add basic loading/error handling in the report so failed queries do not silently look like "no data".
3. Keep the current summaries/table logic intact, only changing the data-fetch behavior needed to make records appear.
4. Validate by checking that the attendance report shows existing rows for the current date range and active division context.

## Technical details
- File to update: `src/components/reports/AttendanceReports.tsx`
- Likely query change:
  - replace strict `.eq("division_id", divisionId)`
  - with the same pattern used in `src/pages/Attendance.tsx`: `or("division_id.eq.<id>,division_id.is.null")`
- No database schema change is required for this fix.