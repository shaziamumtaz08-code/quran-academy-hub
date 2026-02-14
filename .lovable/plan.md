

## Add "Left" Status for Students/Teachers

### What It Does
Adds a **"Left"** status option alongside the existing Active, Paused, and Completed statuses. Users marked as "Left" will have their data preserved but will not appear in active lists, student cards, or teacher dashboards.

### Changes

**1. Database Migration**
- Add `'left'` to the `assignment_status` enum type so assignments can be marked as "Left".

**2. File: `src/pages/Students.tsx`**
- Update the `AssignmentStatus` type to include `'left'`.
- The teacher query already filters by `['active', 'paused']`, so "left" students are automatically excluded from the teacher's card view.
- For the admin student list, add a status filter dropdown so admins can optionally view "left" students. By default, "left" students are hidden.

**3. File: `src/components/students/StudentCard.tsx`**
- Update the `AssignmentStatus` type to include `'left'`.
- Add a `left` entry to `STATUS_CONFIG` with a red/muted badge style.
- Treat `left` as inactive (same as `paused`/`completed` -- no attendance button shown).

**4. File: `src/pages/UserManagement.tsx`**
- Where assignment status can be changed (if applicable), add "Left" as an option in any status dropdowns.

**5. File: `src/pages/Teachers.tsx`**
- If teachers are listed via assignments, ensure "left" assignments are excluded from active teacher lists by default.

### How "Left" Differs from "Archived"
- **Archived** (`archived_at` on profiles): Hides the entire user profile system-wide.
- **Left** (`assignment_status = 'left'`): Hides a specific student-teacher assignment from active views, but the student profile remains visible for other assignments or administrative purposes. A student can be "left" from one teacher but still active with another.
