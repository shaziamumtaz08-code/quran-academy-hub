# Student registrations: per-student rows, cleaner header, profile photos

## 1. One row per student (no more consolidated "family" row)

Today a parent submitting for 2 children creates **one** pending record holding both children in a list, so the review screen shows a combined view.

New behaviour:
- The public student form still lets a parent add several children in one go (that convenience stays).
- On submit it creates **one pending registration per student**, each carrying a full copy of the parent/guardian and household data (name, relationship, phones, email, city, country, timezone, address, emergency contact, notes).
- All rows from the same submission share a hidden group id, so we can still link siblings to the same parent account on approval — no duplicate parent user is created.
- The registrations list then shows one row per student: student name as the headline, parent name underneath, plus category, contact, location, submitted date, status.
- The review page becomes a **student profile review**: student details on top, parent/guardian details replicated below, approve/reject per student.
- On approval, the student profile is created with the parent's shared data already filled in, the parent account is created once, and every sibling gets linked to it.

Existing combined records already in the system stay readable — the review page keeps rendering multiple students if an old record has them.

## 2. Wording cleanup

Remove "family" from anything a user sees, replacing with student-registration language:
- Page title "Applications & registrations" stays; the filter tab "Students / families" becomes "Students".
- Badges "Student / family" become "Student".
- Review page: "Family notes" card becomes "Notes & preferences"; stat tile "Family" becomes "Student".
- Public form header line "for all the children in a family" becomes "for one student or several siblings in one submission".
- Sidebar/nav and route labels referencing family registrations become "Registrations".
- Internal table and code names stay as-is (no schema renames), only visible text changes.

## 3. Profile header fix + photo upload

- The review/profile header currently lets the name and action buttons collide with the banner on narrower widths (name clipped, buttons overlapping). The header will be rebuilt so the banner, avatar, name block and action buttons stack cleanly: taller banner, avatar and name on their own row, actions wrapping onto a second row on small screens, no clipping.
- Add a **profile photo** control on the avatar: hover/click to upload (JPG/PNG, resized-safe size limit), with a remove option. Available on:
  - registration review (photo saved with the pending record and carried onto the created profile),
  - student, teacher and parent profile pages (admins, plus users on their own profile).
- Photos are stored in a new public `avatars` storage bucket; only the owner or an admin can upload/replace, anyone signed in can view.

## Technical notes

- Migration: add `student_name`, `family_group_id` (uuid), `avatar_url` to `family_registrations` (all nullable, extend-only); create the `avatars` bucket with owner/admin write policies and public read.
- `StudentRegistration.tsx`: submit maps `students[]` to N inserts sharing one generated `family_group_id`; each row keeps `children` as a single-element array for backward compatibility with the review UI and approval function.
- `approve-registration` edge function: when a row has a `family_group_id`, reuse/create the parent account once (lookup by email), attach the student, and write `avatar_url` into the created profile.
- `FamilyRegistrations.tsx`: row headline uses `student_name` when present, falls back to first child, then parent name; add a "Parent" column.
- `RegistrationReview.tsx`: header rework + avatar upload; student card first, parent card second.
- `ProfileKit.tsx`: `ProfileHero` gains an optional `onAvatarChange` handler and a fixed responsive layout; reused by student/teacher/parent profiles.
