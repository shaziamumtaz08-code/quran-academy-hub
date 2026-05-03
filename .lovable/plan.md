## Problems

1. **Export Users button fails for Division Admins.** The `export-users` edge function scopes "allowed users" to `user_context.user_id IN (division)` only. Students/teachers join the division through `student_teacher_assignments` / `course_class_*`, not through `user_context`. So for a Division Admin the allowed set is tiny (sometimes 0) → returns `"No users in your division"` and the button appears broken.
2. **Division Admins see all 211 users (including other divisions).** The list query fetches every profile, and `filteredUsers` keeps any user whose memberships include the active division *or* who has a "global" role. Because `admin` and `admin_division` are in `GLOBAL_ROLES`, admins from other divisions leak in. There is also no enforcement that a Division Admin cannot pick `All Divisions (combined)` or another division in the filter.
3. **Division filter dropdown exposes other divisions / "All Divisions" to Division Admins** (image 4) — should be limited to their own division(s).
4. **Group Academy vs 1:1 show identical lists.** Symptom of the same root cause as #2 — the People listing is not filtered by `division_id` server-side; UI filtering treats global-roled users as universally visible. (Course/Student/Teacher pages need the same audit, tracked as a follow-up.)

## Fix

### A. `src/pages/UserManagement.tsx`
- Restrict the **Division filter** for non-super-admins:
  - Build options from `useDivision().switcherOptions` (what the user is actually entitled to). Hide `"All Divisions (combined)"` and any division they don't belong to. Super Admin keeps current behavior.
  - If the user has only one division, render the value as a read-only chip (no Select) — matches the rest of the app's UX.
- Tighten `filteredUsers` for non-super-admins:
  - Remove the "global role with no memberships" escape hatch for `admin` / `admin_division` — those are still division-scoped people. Keep it only for `super_admin`.
  - Require a membership match against `effectiveDivisionId` for everyone else.
- Disallow `__all__` / cross-division values in `filterDivision` state for non-super-admins (guard `setFilterDivision`).
- Remove `admin_division` from `GLOBAL_ROLES`. Keep `super_admin` only as global; `admin*` legacy roles should be treated as division-scoped (they show only when actually assigned to that division via `user_context`).
- Update the user-count chip (`Users (N)`) to reflect the scoped count.

### B. `src/components/users/ExportUsersDialog.tsx`
- For Division Admin, default scope = `my_division`, hide `all`. Already partially in place — verify "Filtered" passes the resolved `filteredUserIds` (works once A is fixed).

### C. `supabase/functions/export-users/index.ts`
Replace the `user_context`-only allowed-id derivation with the same membership logic the UI uses:

```ts
// Collect division members from all sources
const allowedIds = new Set<string>();

// 1) user_context (admins, staff bound directly)
const ctx = await adminClient.from('user_context')
  .select('user_id').eq('division_id', callerDivisionId);
ctx.data?.forEach(r => allowedIds.add(r.user_id));

// 2) 1:1 assignments (students + teachers)
const sta = await adminClient.from('student_teacher_assignments')
  .select('student_id, teacher_id').eq('division_id', callerDivisionId);
sta.data?.forEach(r => { allowedIds.add(r.student_id); allowedIds.add(r.teacher_id); });

// 3) Group: students via course_class_students -> course_classes -> courses(division_id)
// 4) Group: staff via course_class_staff -> course_classes -> courses(division_id)
// 5) Parents: derive from student_parent_links where student_id ∈ allowedIds
```

Then `query = query.in('id', [...allowedIds])`. This fixes the empty-export bug and matches the on-screen list exactly. Also: when `exportType === 'my_division'`, skip the "selected/filtered" branches and just use `allowedIds`. For `exportType === 'filtered'`, intersect `allowedIds` with the search-matched ids so a Division Admin's filtered export never leaks other divisions.

### D. Out of scope for this change (logged for follow-up)
The "both menus identical" symptom on Students / Teachers / Courses pages comes from the same pattern (client-side filter, no division scoping). Fix in a dedicated pass after this lands so we can verify the User Management fix in isolation.

## Files Touched
- `src/pages/UserManagement.tsx` — division filter UI, GLOBAL_ROLES, filteredUsers logic, count chip.
- `src/components/users/ExportUsersDialog.tsx` — minor: ensure default scope/labels for division admins.
- `supabase/functions/export-users/index.ts` — replace allowed-id derivation with multi-source membership.

## Acceptance
- As a Division Admin in 1:1: list shows only 1:1 users; switching active division to Group shows only Group users.
- Division filter dropdown shows only the admin's own division(s); no `All Divisions` option.
- Export button downloads a CSV/XLSX containing the same set the table shows.
- Super Admin behaviour is unchanged.
