# Personal Library Spaces for Everyone

## What you asked for

Every user (teacher, student, parent, admin) gets their own personal library space. They can:
1. Upload their own files into it.
2. Save anything from the shared academy Library into it as a shortcut (no duplicate file).

And about the question you didn't understand — it was simply asking: **when a teacher opens the file picker inside a class (VCR room), which files should they see?** Your answers imply: the official syllabus files **plus the teacher's own personal uploads**. When a teacher shows a personal file in class, the student automatically keeps access to it afterwards.

## What exists today (verified)

- Only admins and teachers can upload to the Library; students/parents cannot.
- A "Favorites" feature already exists (`library_favorites` table, per-user rules, Favorites tab) — this is exactly the "save a reference" mechanism, so we build on it rather than duplicate it.
- The class (VCR) file picker currently shows only files marked as syllabus.

## What we'll build

### 1. My Library tab (everyone)
- New **"My Library"** tab on the Library page, visible to every signed-in user, containing:
  - **My Uploads** — files the user uploaded themselves.
  - **Saved from Library** — their favorited/shared-library shortcuts (existing favorites).
- Upload button becomes available to **all roles**. Uploads by students/parents are automatically **personal** (private to them), never published to the shared academy Library. Staff uploads keep the current behaviour (can be published/shared).

### 2. Personal files stay private (database)
- Add `is_personal` flag to `library_items`.
- Access rules: a personal item is visible only to its owner and to admins. Saving/sharing rules stay as they are for everything else.
- Existing storage (the private `resources` bucket) is reused — no new buckets.

### 3. Class viewer (VCR) picker includes personal files
- The teacher's "Book / PDF" picker in the VCR room will list: syllabus files **+ the teacher's own personal uploads** (clearly labelled "My file").
- Students and parents never get this picker — they just see what the teacher opens.

### 4. Shown in class = shared with the student
- When a teacher opens one of their **personal** files in a class, the system records a share for that student automatically (new `personal_item_shares` table: item, student, shared by, when).
- The student (and their linked parents) then see that file in a **"Shared with me"** section of their Library and can open it any time.
- Official syllabus/shared-Library files need no share record — access already follows Library rules.

## Technical details

- **Migration 1:** `ALTER TABLE library_items ADD is_personal boolean NOT NULL DEFAULT false`; RLS: owners (and admins) can read/update their personal items; any authenticated user can INSERT with `uploaded_by = auth.uid()` and `is_personal = true` unless they're staff publishing shared items.
- **Migration 2:** `CREATE TABLE personal_item_shares` (item_id → library_items, student_id, shared_by, created_at) + GRANTs + RLS (owner/teacher shares; student, linked parents via `student_parent_links`, and admins can read).
- **Files:** `src/pages/Library.tsx` (My Library tab + Shared with me), `LibraryAddItemDialog.tsx` (role-aware: personal by default for non-staff), `src/pages/VcrRoom.tsx` (picker query + auto-share on open), small hook `usePersonalLibrary.ts`.
- Extend-only: nothing renamed or deleted; existing syllabus behaviour untouched.

## Verification

- Typecheck + build.
- Confirm with test queries that a student cannot see another user's personal file.
- No live multi-browser class test will be claimed unless actually run.
