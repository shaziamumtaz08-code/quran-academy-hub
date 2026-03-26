

# AI-Powered Course Builder & Premium Workspace

## Overview
Replace the current Course detail modal/sheet with a full-page split-pane Course Builder at `/courses/:id`. This includes an interactive syllabus builder (left pane), AI-powered content editor (right pane), and tabs for Settings and Roster management.

## Database Changes (3 new tables + 1 storage bucket)

### Table: `course_modules`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| course_id | uuid | references courses |
| title | text | |
| sort_order | integer | default 0 |
| created_at / updated_at | timestamptz | |

### Table: `course_lessons`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| module_id | uuid | references course_modules |
| course_id | uuid | references courses |
| title | text | |
| content_type | text | 'text', 'video', 'document' |
| content_html | text | nullable, for text lessons |
| video_url | text | nullable, for video lessons |
| file_url | text | nullable, for document lessons |
| sort_order | integer | default 0 |
| created_at / updated_at | timestamptz | |

### Storage bucket: `course_materials`
Public bucket for PDF/document uploads linked to lessons.

### RLS
- Admins/super_admins: full CRUD on both tables and storage
- Teachers: SELECT on courses they own, UPDATE on lessons for their courses
- Students: SELECT on courses they're enrolled in

## Edge Function: `generate-course-content`
- Uses Lovable AI (gateway) with `google/gemini-3-flash-preview`
- Accepts `{ prompt: string, lessonTitle: string }` 
- Returns structured HTML content for the lesson
- CORS enabled, `verify_jwt = false`

## New Files

### `src/pages/CourseBuilder.tsx` (full-page route)
- **Top bar**: Breadcrumb (Courses > Course Name), "Save Changes" button, "Publish" toggle (updates `courses.status`)
- **Tabs**: Builder | Settings | Roster & Bulk Add
- **Builder tab** — Split-pane layout:
  - **Left pane (35%)**: Syllabus outline with accordion modules, drag-to-reorder via `@dnd-kit/sortable`, "Add Module" button, "+Lesson" on hover per module. Icons per content_type (video/text/document).
  - **Right pane (65%)**: Content editor that changes based on selected lesson's `content_type`:
    - **Text**: Rich text editor (TipTap or simple contentEditable with toolbar) + "Generate with AI" button
    - **Video**: URL input + iframe preview
    - **Document**: File upload dropzone → `course_materials` bucket
- **Settings tab**: Edit course name, teacher, subject, dates, max students
- **Roster tab**: Current enrollment table + CSV bulk upload (maps First Name, Last Name, Email → auto-creates profiles and enrollments)

### Route addition in `App.tsx`
```
/courses/:id → <CourseBuilder />
```
Admin-protected route. The existing `/courses` list page gets a "View" button linking to `/courses/:id` instead of opening a sheet.

## Modifications to Existing Files

### `src/pages/Courses.tsx`
- Change "View" button to navigate to `/courses/${course.id}` via `useNavigate()`
- Remove the Sheet-based detail panel (or keep as fallback)

### `supabase/config.toml`
- Add `[functions.generate-course-content]` with `verify_jwt = false`

## AI Generation Flow
1. User clicks "Generate with AI" in right pane
2. Small prompt modal: "What should this lesson cover?"
3. Calls edge function → Lovable AI gateway
4. Streams response back, injects HTML into the editor
5. User can edit the generated content before saving

## Design Tokens
- Background: `bg-slate-50`
- Panes: `bg-white shadow-sm rounded-xl`
- Hover states: `hover:bg-slate-100` on syllabus items
- Smooth transitions on tab switches and AI loading (skeleton placeholders)

## Implementation Order
1. DB migration (tables + bucket + RLS)
2. Edge function `generate-course-content`
3. `CourseBuilder.tsx` page with split-pane layout
4. Wire up route in `App.tsx`, update `Courses.tsx` navigation
5. AI integration in content editor

