

## Composite Fee Builder: Individual vs Bulk Selection Mode

### Overview
Add a toggle in the "Set Up Student Fee" modal that switches between **Individual** mode (current search-based selection) and **Bulk** mode (full sortable/filterable student list with checkboxes). This makes it easy to apply the same fee package to groups of students based on country, subject, or name.

---

### How It Works

**Individual Mode** (current behavior, unchanged):
- Search students by name, click to add as badges.

**Bulk Mode** (new):
- Shows a full scrollable table of all students with columns: Checkbox, Name, Country, Subject(s).
- **Sorting**: Click column headers (Name, Country, Subject) to sort alphabetically.
- **Filtering**: Search bar filters across name, country, and subject simultaneously.
- **Selection**: Tick individual checkboxes or use "Select All (filtered)" to bulk-select visible rows.
- Selected students feed into the same `selectedStudentIds` array used by the existing save logic.

---

### UI Layout in the Modal

A segmented toggle ("Individual" | "Bulk Select") appears at the top of the Students section.

- **Individual**: Shows the current search input + badge chips (no changes).
- **Bulk Select**: Replaces the search area with:
  - A search/filter input (filters by name, country, subject).
  - A compact table inside a scroll area (~250px max height):
    | Checkbox | Student Name | Country | Subject |
  - A "Select All Filtered" checkbox in the header.
  - A summary line: "X of Y students selected".

---

### Technical Details

**Data Fetching Changes:**
- Expand the student query to also fetch `country` from `profiles`.
- Add a secondary query to fetch each student's subject(s) via `student_teacher_assignments` joined with `subjects`.
- These queries only fire when `setupOpen` is true (already the pattern).

**New State:**
- `selectionMode: 'individual' | 'bulk'` -- toggles the UI.
- `bulkSearch: string` -- filter text for the bulk table.
- `bulkSort: { column: 'name' | 'country' | 'subject', direction: 'asc' | 'desc' }` -- sort state.

**Filtering Logic (Bulk Mode):**
- Filter students where name, country, or any subject name matches the search term (case-insensitive).
- Sort by the selected column and direction.

**No Schema Changes Required** -- all data already exists in the database.

**Files Modified:**
- `src/pages/Payments.tsx` -- Add the toggle, bulk table UI, expanded student query, and sorting/filtering logic within the existing fee builder modal.
