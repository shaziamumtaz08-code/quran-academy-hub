# Teachers & Students tabs = filtered User Management rows

## Goal
The Teachers tab and Students tab under People should look and behave exactly like the User Management table — same rows, same columns, same icons, same eye/actions — just pre-filtered to that role. The "Assigned Students" expansion that currently sits on the Teachers list page moves into the teacher's own profile page, at the bottom.

## What changes

### 1. One shared table, three tabs
- User Management gets an optional "locked role" mode. When locked to `teacher` or `student`:
  - only users with that role are listed,
  - the role filter dropdown is hidden (it's already implied by the tab),
  - the page heading/description reflects the tab ("Teachers", "Students"),
  - everything else stays identical: search, country/city/status/gender/division filters, ID & roles column with division-coloured icons, archived badge, sticky horizontal scrollbar, row click → profile drawer, eye icon → full profile, edit / impersonate / delete actions, bulk actions for super admins.
- People → Teachers renders that table locked to `teacher`; People → Students renders it locked to `student`. The old bespoke Teachers/Students tables are retired from those tabs.
- Role-specific extras that only make sense on those tabs (e.g. the student stats strip, registration-link card placement) are kept above the table where they already exist, so nothing useful is lost.

### 2. Assigned students move into the teacher profile
- Remove the expandable "Assigned Students" row from the Teachers list (no more chevron column there).
- On the teacher profile page (`/teacher-profile/:id`), the bottom "Assigned students & subjects" section is upgraded to the card grid from the screenshot: one card per student with avatar, name, age • gender, and subject line, plus the schedule details already fetched. Clicking a student card opens that student's profile.
- The equivalent bottom sections on the student profile (parents/relationships + enrolled subjects & teachers) stay as they are.

## Technical notes
- `src/pages/UserManagement.tsx` gains a `lockedRole?: 'teacher' | 'student'` prop; the role filter state is initialised from it and the `Select` for role is not rendered when set. No duplicate table markup is created.
- `src/pages/PeopleLanding.tsx` maps `view=teachers` / `view=students` to `<UserManagement lockedRole="..." />` instead of the lazy `Teachers` / `Students` pages for the table portion.
- `src/pages/Teachers.tsx` keeps its data hooks only where still needed; the assigned-students rendering block is lifted into `src/pages/TeacherProfile.tsx` (or a small `TeacherAssignedStudents` component reused by it).
- Direct routes `/teachers` and `/students` continue to work and show the same filtered table.
