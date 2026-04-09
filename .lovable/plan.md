

# Navigation & UX Fixes — Revised Plan

## Issues Addressed

1. **Teachers see full admin Teaching menu** — Live Classes opens Zoom Engine, Subjects shows 10, Schedules shows 10. Teachers should only see their own data (My Students, Attendance, Schedules for their classes).
2. **Chat allows DMs but should NOT allow Group creation** for non-admins.
3. **Mobile: Role Switcher invisible**, only tiny logout arrow visible.
4. **Mobile hamburger opens full white AppSidebar** instead of a sleek nav drawer.
5. **Resources link opens home page** — remove from teacher/student nav.
6. **Chat renamed to Communication**, landing on card page not messages.
7. **Sign out button too small/invisible** — integrate into user menu.
8. **Breadcrumbs not sticky** — forces scroll up.
9. **Teaching OS hidden from 1-to-1**.
10. **Teacher needs Salary tab; Student needs Classes tab and Calendar**.

---

## Changes by File

### 1. `src/pages/TeachingLanding.tsx`
- Add role check using `useAuth().activeRole`
- **If teacher**: filter cards to show only: **My Students** (assignments count, filtered by teacher_id), **Schedules** (filtered by teacher), **Attendance** (filtered by teacher), **Planning**
- Hide: Live Classes, Subjects, Courses (these are admin-only)
- Adjust queries to filter by `user.id` for teacher role so counts reflect their data only

### 2. `src/components/layout/NavRail.tsx`
**Teacher nav:**
- Remove: `Resources` (FolderOpen)
- Rename `Chat` → `Communication`, href `/chat` → `/communication`
- Add: `Salary` (DollarSign icon, href `/salary-engine`)
- Keep: Home, My Classes, My Students, Attendance, Planning, Communication, Salary

**Student nav:**
- Remove: Resources, Progress (duplicate)
- Add: `Classes` (BookOpen, href `/teaching`), `Calendar` (CalendarDays, href `/schedules`)
- Rename Chat → Communication, href → `/communication`

**Parent nav:**
- Rename Chat → Communication, href → `/communication`

### 3. `src/components/layout/MobileBottomNav.tsx`
**Teacher tabs:** Home, Classes (`/teaching`), Attendance (`/attendance`), Calendar (`/schedules`), Communication (`/communication`)
- Remove "More" sheet for teachers

**Student tabs:** Home, Classes (`/teaching`), Attendance (`/attendance`), Calendar (`/schedules`), Communication (`/communication`)

**Admin tabs:** Home, Teaching, People, Communication (`/communication`), More

### 4. `src/components/layout/MobileTopBar.tsx`
- Import and render `RoleSwitcher` between the title and the right icons
- Replace the tiny `LogOut` button with a dropdown menu containing: user name, role label, role switcher options, divider, Sign Out button (red, clearly visible)

### 5. `src/components/layout/DashboardLayout.tsx` (mobile section)
- Replace `AppSidebar` in the mobile drawer with a **styled NavRail list**: dark navy background (`bg-lms-navy`), vertical list of rail items with icon + label, sign-out at bottom
- Remove the white AppSidebar entirely from mobile drawer

### 6. `src/pages/GroupChat.tsx`
- Import `useAuth` and check `activeRole`
- Hide "New Group" button (`setCreateOpen`) unless role is admin/super_admin/admin_*
- Keep "New DM" button (`setDmOpen`) visible for all roles

### 7. `src/components/layout/PageBreadcrumb.tsx`
- Add `sticky top-0 z-10 bg-[#f4f5f7]` to the breadcrumb wrapper so Home/Back is always accessible without scrolling

### 8. `src/components/layout/AppSidebar.tsx`
- In `getTeachingSidebar()`: hide "AI Teaching OS" item when `isOneToOne` is true (already partially done, verify and fix)

---

## No Database Changes Required

All changes are frontend navigation and UI only.

