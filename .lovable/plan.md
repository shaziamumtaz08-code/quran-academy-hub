## Problem

The colored dots overlaid on role icons are visually noisy and there's no way to actually *set* a status for a role that isn't tied to an assignment (admins, examiners, teachers without assignments, etc.). Status today is only inferred from `student_teacher_assignments` / `course_class_students`, so a teacher with no current assignment has no status at all.

## Goal

1. Remove the status dots from role icons.
2. Add a real `status` field to every role enrollment (`user_roles`) with values: `active | paused | left | completed | inactive`.
3. Show a clean **Status** column in the User Management table — one chip per role, color-coded, click to edit.
4. When a role is added via Assign Role, status defaults to `active`. When a role is removed, history stays via the new column.
5. Users who have no division membership (and no role with active status) display as `inactive` automatically — no manual toggle needed.

## Schema change

Extend (don't rename) `public.user_roles`:

```sql
alter table public.user_roles
  add column if not exists status text not null default 'active',
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id);

-- validation trigger (not check constraint, per project rule)
create or replace function public.fn_validate_user_role_status()
returns trigger language plpgsql as $$
begin
  if new.status not in ('active','paused','left','completed','inactive') then
    raise exception 'Invalid status: %', new.status;
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  return new;
end$$;

drop trigger if exists trg_validate_user_role_status on public.user_roles;
create trigger trg_validate_user_role_status
  before insert or update on public.user_roles
  for each row execute function public.fn_validate_user_role_status();
```

RLS: keep existing PERMISSIVE policies; admins already manage the table.

## Frontend changes

**`src/pages/UserManagement.tsx`**
- Remove the dot rendering at lines ~2033–2042 (keep icons only).
- Add a new **Status** TableHead between "ID & Roles" and "Phone" in both staff and main tables.
- Render one compact chip per role using a new `RoleStatusChips` component:
  - `active` → emerald, `paused` → amber, `left` → rose, `completed` → sky, `inactive` → slate.
  - Layout: `Teacher · Active`, `Student · Paused`, etc. — small pill, click opens a popover.
- Click → popover with a select to change status; calls a new mutation `updateRoleStatus({ userId, role, status })` that updates `user_roles` directly.
- Fallback rule: if a user has zero division memberships AND every role status is `active`, display the global aggregate as **Inactive** (greyed badge) — does not write to DB, purely visual.

**`src/hooks/useDivisionMembership.ts`**
- Source `status` from `user_roles.status` first; only fall back to assignment-derived status if `user_roles.status = 'active'` (so paused/left flagged on the role wins).

**`src/components/users/AssignRoleDialog.tsx`**
- New role insert already defaults to `active` via the column default — no change needed beyond verifying the insert doesn't pass an explicit status of something invalid.

## What stays the same

- No table renames, no column drops (extend-only schema rule).
- Archive/Restore button stays in the Actions cell.
- Role icons in the ID column stay — just without the dots.

## Out of scope

- Bulk status edit (can add later from row-select toolbar).
- Per-assignment status (already exists on `student_teacher_assignments`).
