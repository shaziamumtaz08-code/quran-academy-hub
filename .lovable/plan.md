# Send Resources to the Library

## The short answer

No Google Drive embed is needed, and no re-uploading one by one.

Your Drive files are already imported into the LMS — they live in the course Resources area (stored in the `course-materials` bucket, tracked in `course_library_assets`). The Library is a separate shelf (`library_items`, files in the `resources` bucket). So this is an internal copy job, not a new import.

We add a "Send to Library" action in Resources. Pick one file or tick several, choose a Library category once, and the LMS copies the files across and creates the Library entries. Anything still sitting in Drive that was never imported can keep using the existing upload/link options.

## What you'll see

In the course Resources tab:

- A checkbox on each uploaded asset, plus "Select all".
- A "Send to Library" button (works for one item or a whole selection).
- A short dialog asking for: Library category, visibility (Student / Parent / Teacher / Admin / All), status (Published or Draft), and whether downloads are allowed. Titles, file type, and file size are filled in automatically from the resource.
- A progress line while copying, then a summary: how many were added, how many were skipped as already-in-Library, and any failures listed by name.
- Items already sent show an "In Library" badge so nobody duplicates them.

Link-type resources (a URL rather than a file) are sent as Library link items — nothing to copy.

## How it works

1. **Copy, not reference.** Each file is copied into the Library's own storage, so editing or deleting the course resource later never breaks the Library entry.
2. **Server-side copy.** A new edge function (`library-import-resource`) does the copy inside the backend — the file never travels through the browser again, so a 200 MB video imports as fast as a 1 MB PDF.
3. **Duplicate guard.** The source resource id is recorded on the Library item; re-sending the same resource updates the existing entry instead of creating a second copy.

## Technical notes

- Migration: add `source_asset_id uuid` (nullable, FK to `course_library_assets`, `ON DELETE SET NULL`) and a unique index on it to `library_items`. Extend-only; nothing renamed or dropped.
- New edge function `supabase/functions/library-import-resource/index.ts`: takes `assetIds[]` + category/visibility/status/download flags, verifies the caller is admin (or the course owner), downloads each object from `course-materials`, uploads it to `resources` under `library/`, infers `type` from the extension using the same map as `LibraryAddItemDialog`, and inserts/updates `library_items`. Returns per-asset `{ ok | skipped | error }`.
- Frontend: selection state + `SendToLibraryDialog` in `src/components/courses/CourseResourcesTab.tsx`, reusing `VisibilitySelect` and the existing category fetch from `library_categories`. Invalidate Library queries on success.
- Grants/RLS: the new column inherits existing `library_items` policies; the edge function uses the service role for the storage copy after its own permission check.
- No change to `LibraryAddItemDialog`, `Library.tsx` display logic, or the Drive/OneDrive helper buttons in `UploadFileDialog`.
