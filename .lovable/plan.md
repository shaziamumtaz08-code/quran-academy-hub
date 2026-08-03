# Uniform profiles across Students, Teachers and Staff

Three changes: strip the duplicated header from the role-scoped tabs, retire the drawer in favour of the full profile page, and give teachers/staff the same styling the student profile already has.

## 1. Clean the Students / Teachers / Staff headers

On the role-scoped views (Students, Teachers, Staff), keep only the page title and its one-line description. Remove:

- Refresh, Bulk Import, Export Users, Add User buttons
- The registration links card (Add student / Add teacher / New enquiry)

User Management keeps all of it unchanged — it stays the single place for creating, importing and exporting users.

## 2. Row click and eye icon both open the full profile page

Today a row click opens a side drawer with 8 tabs, and only the eye icon goes to the real profile page. After the change:

- Clicking a row anywhere opens the full profile page for that user.
- The eye icon does the same thing (kept for discoverability).
- The drawer is removed entirely; the pencil/Edit button also lands on the profile page.

Routing by role: student -> student profile, teacher -> teacher profile, parent -> parent profile, everyone else (admin, moderator, supervisor, examiner, staff) -> the teacher-layout profile in "staff mode" (see below).

## 3. All drawer fields move into the profile pages, editable in place

Each profile page gets an "Edit profile" toggle (admins, plus the user themself where appropriate). In edit mode the existing cards turn into editable fields, so nothing from the drawer is lost. Field groups map onto the profile sections:

- Personal (name, display name, DOB, gender, nationality, languages, photo)
- Contact (email, phone/WhatsApp, address, city, country, timezone)
- Identity (registration/URN, government ID, verification)
- Guardian / parents (student profiles) — relationships and contacts
- Academic (student) / Professional & employment (teacher, staff)
- Banking (teacher, staff) — self-declared, admin-visible
- Documents, Payments, Activity — as read sections with upload/manage actions
- Password reset — admin-only action button in the header area

Permission rules stay exactly as the drawer enforced them: sections a role could not see stay hidden, and view-only roles get read-only cards.

## 4. Uniform styling

The student profile is the reference. Teacher, parent and staff profiles are rebuilt on the same shared ProfileKit primitives:

- Full-width gradient hero with avatar upload, name, badges and inline meta (email / phone / location)
- Four colour-coded stat tiles under the hero
- Two-column grid of icon-headed info cards with consistent label/value rows
- Full-width relationship section at the bottom: students -> parents + enrolled subjects/teachers; teachers -> assigned students/courses; staff -> assigned modules/divisions
- Same empty states, same status badges, same spacing

## Technical notes

- `src/pages/UserManagement.tsx`: gate the header actions and `RegistrationLinksCard` behind `!lockedRole && !staffMode`; replace `openProfileDrawer` with a `openProfilePage(user)` navigation helper; delete the `HolisticUserProfileDrawer` usage.
- `src/components/users/HolisticUserProfileDrawer.tsx`: its field definitions, tab access matrix and save mutations are extracted into a reusable `useProfileEditor` hook + field group components under `src/components/profile/`, then the drawer file is removed.
- `src/pages/TeacherProfile.tsx`: drop its local `Card`/`Row`/header implementation and use `ProfileHero`, `StatTiles`, `InfoCard`, `InfoRow`, `EmptyState` from `src/components/profile/ProfileKit.tsx`.
- `src/pages/ParentProfile.tsx`: align to the same four-tile + two-column layout.
- New `src/pages/StaffProfile.tsx` reusing the teacher layout with teaching-only sections hidden and employment/banking retained; routes `/staff-profile` and `/staff-profile/:staffId` added in `src/App.tsx`.
- No database or RLS changes; edits use the existing profile update paths and whitelisted columns.
