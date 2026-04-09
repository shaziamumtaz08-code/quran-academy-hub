

# Course Delete, Class Delete & Duplicate Feature

## What We're Building

Three new capabilities in the Course management area:

1. **Delete entire course** — with cascading cleanup of all related data (classes, enrollments, modules, lessons, etc.)
2. **Delete a single class** — remove one class from a course without affecting the rest
3. **Duplicate a course** — with a checklist dialog asking which internal resources to copy

---

## Implementation

### 1. Delete Course (Courses.tsx)

Add a "Delete" action to each course card (three-dot menu or long-press). Opens a confirmation dialog warning about permanent deletion. On confirm:

- Delete in order to respect FK constraints:
  1. `course_lessons` (by course_id)
  2. `course_modules` (by course_id)
  3. `course_enrollments` (by course_id)
  4. `course_classes` (by course_id) — also nullify `zoom_license_id` refs
  5. `session_plans` (via syllabi linked to course_id)
  6. `syllabi` (by course_id)
  7. `course_assignments`, `course_resources`, `course_notifications` (by course_id)
  8. Finally delete the `courses` row itself

The dialog shows: "This will permanently delete **[Course Name]** and all its classes, enrollments, modules, and resources. This cannot be undone."

### 2. Delete Single Class (CourseClassesTab.tsx)

Add a delete button per class row. Confirmation dialog: "Delete class **[Class Name]**? Students enrolled in this class will be removed."

- Nullify `zoom_license_id` references
- Delete `course_class_students` for that class
- Delete the `course_classes` row

### 3. Duplicate Course (Courses.tsx)

Add a "Duplicate" action next to Delete on each course card. Opens a **Duplicate Course Dialog** with:

- **New course name** field (pre-filled: "Copy of [Original Name]")
- **Checklist of what to duplicate**:
  - [ ] Modules & Lessons (content structure)
  - [ ] Classes (schedule/time slots — without enrolled students)
  - [ ] Assignments
  - [ ] Resources
  - [ ] Registration Form config
  - [ ] Fee Plans
  - [ ] Marketing/Website settings

On confirm:
1. Insert new `courses` row with same metadata, status = 'draft'
2. For each checked item, copy the related rows with new course_id
3. Navigate to the new course builder page

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Courses.tsx` | Add three-dot menu on cards with Delete and Duplicate actions. Add DeleteCourseDialog and DuplicateCourseDialog components inline. |
| `src/components/courses/CourseClassesTab.tsx` | Add delete button per class with confirmation dialog. |

No database changes needed — all operations use existing tables with standard delete/insert queries.

