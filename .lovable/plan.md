

# Fix: "Add Staff" Not Working in Classes Tab

## Root Cause

The `course_class_staff` and `course_class_students` tables were created **without foreign key references** to the `profiles` table. PostgREST requires FK relationships to perform embedded joins like `profile:user_id(id, full_name, email)`.

Every time the Classes tab loads staff or students, the query returns a **400 error**:
> "Could not find a relationship between 'course_class_staff' and 'user_id' in the schema cache"

Staff inserts (POST) succeed (status 201), but the subsequent GET to refresh the list fails, so the UI never shows the added staff.

## Fix

### Step 1: Database Migration — Add Foreign Keys

Add FK constraints from:
- `course_class_staff.user_id` → `profiles.id`
- `course_class_students.student_id` → `profiles.id`

```sql
ALTER TABLE public.course_class_staff
  ADD CONSTRAINT course_class_staff_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.course_class_students
  ADD CONSTRAINT course_class_students_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

### Step 2: Fix Query Syntax in CourseRoster.tsx

The Roster component uses `profiles:profiles!inner(...)` syntax which also won't work without a FK. After the migration, update to use the correct FK hint:
- `staff:course_class_staff(id, user_id, staff_role, profile:user_id(id, full_name, email))`
- `students:course_class_students(id, student_id, status, profile:student_id(id, full_name, email))`

### Step 3: Fix TeacherPayouts.tsx Query

Same FK-based join fix for the payout queries that reference `profile:user_id(...)`.

### Files Changed
- **Migration SQL** (new) — add 2 foreign keys
- `src/components/courses/CourseClassesTab.tsx` — queries already use correct syntax, will work once FK exists
- `src/components/courses/CourseRoster.tsx` — fix join syntax to use FK hint
- `src/pages/TeacherPayouts.tsx` — fix join syntax to use FK hint

### What This Fixes
- Staff list loads after adding a teacher/moderator
- Student list loads in class detail
- Roster view shows names instead of errors
- Teacher payouts page resolves staff profiles

