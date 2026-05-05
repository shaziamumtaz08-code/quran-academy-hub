# Connections Graph — Subject Card for 1:1 + Fix Abida's Stale Role Icons

Two distinct fixes in this loop.

---

## 1. Show a "Subject / Programme" card for 1:1 students

Right now the graph builds `course` (orange, bottom row) cards only from `course_enrollments` and `course_class_students` — which are Group/Recorded data sources. A pure 1:1 student therefore has nothing in the bottom quadrant, while a Group student gets a nice course card.

For 1:1 students the equivalent of "what am I studying" is the **subject of their active `student_teacher_assignments`** (e.g. Nazra, Hifz, Tajweed). We currently expose subject only as the small subtitle under the Teacher card.

### Change in `src/components/connections/UserConnectionsGraph.tsx`
- Extend `fetchAsStudent` to also return a `subjects` array built from `student_teacher_assignments`:
  - `{ key: subject_id||subject_name, name: subject.name, teacherName, status }`
  - One entry per **distinct subject** (de-dupe across multiple assignments of the same subject).
- In `buildGraph`, push these into the `below` quadrant as a new `RelKind = 'subject'` card:
  - Style: warm teal (e.g. `#F0FDFA` bg / `#0F766E` left border) with a `BookMarked` (or `GraduationCap`) icon and header **"Studying"**.
  - Subtitle = teacher name(s) joined; meta = subject status.
- Add `EDGE_STYLE.subject` = `{ color: '#0F766E', dashed: true, label: 'Studying' }`.
- Add a corresponding `LegendRow` entry.
- Keep existing `course` cards for Group/Recorded students unchanged. A user holding both 1:1 and Group will see both kinds in the bottom row.

No schema, no RLS, no query restructuring — purely graph composition.

---

## 2. Fix Abida's three role icons (User Management table)

Screenshot shows Abida (`AQT-000025`) with **Teacher · Student · Teacher**, but per the user she is **Teacher in 1:1 only** (and Student in a Recorded course — that one is correct per image-466 showing TAFSEER-E-QURAN enrollment). The third "Teacher" icon is stale.

### Root cause
`useDivisionMembership` was previously fixed to trust **every** `user_context` row as the user's role in that division. That re-introduced stale teacher rows: when a user has a `user_context` entry with `primary_role = 'teacher'` for a division they no longer staff (no `course_class_staff` and no `student_teacher_assignments`), we still emit a Teacher icon there.

### Fix in `src/hooks/useDivisionMembership.ts`
Tighten the `user_context` fallback so it only **fills in** divisions where we have no roster signal, instead of additively asserting roles:

1. Build all roster-derived memberships first (1:1 STA, group `course_class_students`, group `course_class_staff`).
2. Then, for `user_context` rows:
   - If `primary_role` is an admin-style role (`super_admin`, `admin`, `admin_division`, `admin_admissions`, `admin_fees`, `admin_academic`, `examiner`, `moderator`, `supervisor`) → add as today (admins are not on rosters).
   - If `primary_role` is `student` / `teacher` / `parent` → only add when that user has **no roster-derived role of any kind** in that specific division. This preserves the earlier "26 unassigned" fix (users with zero roster rows still get their context-derived division) **without** stamping a phantom Teacher on top of someone who is genuinely only a Student in that division.

This will collapse Abida's icons to the correct two: **Teacher (1:1)** and **Student (Recorded)**, matching her actual roster.

### Verification
After deploy, the User Management ID & Roles cell for `AQT-000025` should show exactly two icons (Presentation in 1:1 color + GraduationCap in Recorded color), and the previously-fixed "unassigned users" banner count should remain stable (re-check before/after).

---

## Files touched
- `src/components/connections/UserConnectionsGraph.tsx` — add Subject card kind + edge style + legend; extend `fetchAsStudent`.
- `src/hooks/useDivisionMembership.ts` — tighten `user_context` merge for non-admin roles.

No DB migrations. No route changes.
