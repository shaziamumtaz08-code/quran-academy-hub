## Goal
1. Drop the `Paused` status everywhere (DB enum + all UI/guards).
2. Replace User Management's two-row filter mix with **one compact row of 5 multi-select dropdowns**: Role · Status · Gender · Country · City — Excel-style checkbox menus.
3. Apply the four execution refinements requested.

---

## Execution order (strict)

### Step 1 — DB migration (run first, confirm zero errors before touching code)
- Pre-flight `UPDATE` every column using the `assignment_status` enum to convert any leftover `paused` → `on_hold` (defensive — current count is 0).
- Rebuild the enum without `paused`:
  1. `CREATE TYPE assignment_status_new AS ENUM ('active','on_hold','completed','left');`
  2. `ALTER TABLE ... ALTER COLUMN status TYPE assignment_status_new USING status::text::assignment_status_new` for every dependent column (`student_teacher_assignments.status`, plus any column found via `pg_type` lookup on the old enum — `course_class_students`, `course_class_staff`, etc.).
  3. `DROP TYPE assignment_status;` then rename `assignment_status_new` → `assignment_status`.
- Update `fn_validate_user_role_status` to drop `'paused'` from its allowed-list check.
- Verify with `SELECT enum_range(NULL::assignment_status);` returning exactly the 4 values.

### Step 2 — Strip `paused` from the codebase
- `src/lib/assignmentStatusRules.ts` — remove the `paused` key, drop it from the `AssignmentStatus` union and from `SALARY_LOOKUP_STATUSES`, `INVOICE_GENERATION_STATUSES`, `NON_TERMINAL_STATUSES`.
- `src/components/shared/StatusIndicator.tsx` — remove the `paused` map entry and the `'paused'` member from the `StatusVariant` union.
- `src/pages/UserManagement.tsx` — remove `'paused'` from `RoleStatusValue`, `STATUS_OPTIONS`, `STATUS_BY_ROLE`, every badge/dot color map, and the change-status handler signature.
- Sweep these files for `'paused'` literals — remove the option (keep `on_hold` branch where it exists):
  `src/pages/Students.tsx`, `src/pages/Assignments.tsx`, `src/pages/Schedules.tsx`, `src/pages/SalaryEngine.tsx`, `src/pages/Payments.tsx`, `src/components/users/HolisticUserProfileDrawer.tsx`, `src/components/students/StudentCard.tsx`, `src/components/students/TransferAssignmentDialog.tsx`, `src/components/attendance/MissingAttendanceSection.tsx`, `src/components/reports/CourseReports.tsx`, `src/hooks/useDivisionMembership.ts`, `supabase/functions/bulk-validate-import/index.ts`.
- Update the matrix in `.lovable/plan.md` and the `Assignment Lifecycle` memory entry to the 4-status model: `active | on_hold | completed | left` (+ auto-derived `inactive`).

### Step 3 — New shared component `src/components/ui/multi-select-filter.tsx`
- Trigger: `h-9` outlined pill button (chevron-down icon). Empty selection → label only ("Status"); has selection → "Status · 2" with subtle count.
- Content: `Popover` + `Checkbox` list. Each option may have a small color dot rendered via inline `style={{ backgroundColor: <hex> }}` — colors come from the **existing `dotClass` Tailwind values** in `assignmentStatusRules.ts` (e.g. `bg-emerald-500`, `bg-orange-500`, `bg-blue-500`, `bg-rose-600`); a tiny tailwind→hex map at the top of the file translates them so we **introduce zero new color values**.
- Sticky footer: "Clear" + "Select all" buttons.
- Props: `label`, `options: { value, label, dotClass? }[]`, `selected: string[]`, `onChange(values)`, `width?`.

### Step 4 — Refactor User Management filter bar
- Strip `activeCategory` from UserManagement.tsx after a **project-wide `rg "activeCategory" src/`** scan; remove every external reference too (none expected, but verified in this step).
- New filter state shape:
  - `filterRoles: string[]`, `filterStatuses: string[]`, `filterGenders: string[]`, `filterCountries: string[]`, `filterCities: string[]`.
  - Keep `filterDivision` single-select and `showArchived` boolean.
- Toolbar markup (single horizontally scrollable row):
  ```text
  [🔍 Search]  [Role ▾] [Status ▾] [Gender ▾] [Country ▾] [City ▾]  [Division ▾] [Archived] [✕ Reset]
  ```
- Filter logic update inside the existing `filteredAll` chain — Role/Status/Gender/Country/City each apply OR-within / AND-across semantics. City options auto-narrow to picked countries when any country is selected.
- Reset button clears all five arrays + division override + search **and then calls `searchInputRef.current?.focus()`** (a `useRef<HTMLInputElement>` is added to the search `Input`).
- Mobile: row uses `overflow-x-auto`, every pill stays `h-9`, no wrapping.

### Step 5 — Verify
- `rg "paused"` across `src/` and `supabase/functions/` — expect zero hits.
- `rg "activeCategory" src/` — zero hits.
- Open `/users` in preview: confirm one-row filter bar at 1251px, horizontal scroll on mobile, multi-select works for each filter, Reset clears + focuses search, status dots render with correct colors.
- Confirm no "Paused" label appears anywhere (Students, Teachers, Assignments, status dropdowns).

---

## Files touched
**New:** `src/components/ui/multi-select-filter.tsx`, one DB migration.
**Edited:** `src/lib/assignmentStatusRules.ts`, `src/components/shared/StatusIndicator.tsx`, `src/pages/UserManagement.tsx`, `src/pages/Students.tsx`, `src/pages/Assignments.tsx`, `src/pages/Schedules.tsx`, `src/pages/SalaryEngine.tsx`, `src/pages/Payments.tsx`, `src/components/users/HolisticUserProfileDrawer.tsx`, `src/components/students/StudentCard.tsx`, `src/components/students/TransferAssignmentDialog.tsx`, `src/components/attendance/MissingAttendanceSection.tsx`, `src/components/reports/CourseReports.tsx`, `src/hooks/useDivisionMembership.ts`, `supabase/functions/bulk-validate-import/index.ts`, `.lovable/plan.md`, memory entry for Assignment Lifecycle.

## Risk notes
- DB pre-flight confirmed 0 `paused` rows, so the enum rebuild is data-safe.
- Enum rebuild needs every dependent column altered in the same migration — discovered via `pg_attribute` lookup before the script runs.
- No layout shift: `MultiSelectFilter` matches existing `h-9` pill style — same height as the current Country/City selects.