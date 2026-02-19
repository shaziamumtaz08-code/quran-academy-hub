

# Resources Module: Premium UI Redesign + Role-Based Access

## Problems Identified (from screenshot)

1. **Grid cards too narrow** -- 6-column grid causes long names to overflow and overlap
2. **No fixed card height** -- cards vary in size creating a scattered look
3. **No text truncation with tooltips** -- names just clip with `line-clamp-2` but no way to see full name
4. **No visual hierarchy** -- folders and files look the same weight, no sections
5. **No role-based visibility** -- currently Super Admin only; no concept of "who can see what"
6. **Single click vs double click confusion** -- folders require double-click to open, files single-click to open; inconsistent
7. **No resource counts** -- folders don't show how many items they contain
8. **Mobile: cards too small** -- 2-column grid on mobile still cramps long names

---

## Design Strategy: "Digital Library" Experience

### Visual Overhaul

**Grid Layout Fix:**
- Desktop: max 4 columns (not 6) with `min-w-[200px]` per card
- Tablet: 3 columns
- Mobile: 2 columns with compact card variant
- Use `auto-fill` CSS grid for responsive sizing

**Card Redesign (both Folder and File):**
- Fixed aspect ratio cards (roughly square)
- Larger icon area (top 60% of card)
- Name below icon with `truncate` + full name shown in `Tooltip` on hover
- File type badge (small pill: PDF, VIDEO, LINK, etc.) at top-left corner
- Date shown only in list view (remove from grid cards to reduce clutter)
- Single click to open folders (not double click)
- Add item count badge on folders (e.g., "3 items")

**Sections with Headers:**
- Separate "Folders" and "Files" sections with subtle section labels
- Each section has its own heading: "Folders (5)" and "Files (12)"

**List View Polish:**
- Add file size column (where available)
- Type badge pill instead of just icon
- Proper table-like alignment

### Mobile Optimization
- 2-column grid with smaller icons but readable text
- Touch-friendly: 44px minimum tap targets
- Swipe-to-reveal actions (rename, delete) instead of hover-only dropdown
- Bottom sheet for file actions instead of dropdown

---

## Role-Based Resource Access (New Feature)

### Database Changes

**New columns on `resources` table:**
- `visibility` (text, default 'all') -- Values: 'all', 'admin_only', 'teachers', 'students', 'custom'
- `visible_to_roles` (text[], nullable) -- For 'custom' visibility, list of roles

**New columns on `folders` table:**
- `visibility` (text, default 'all')
- `visible_to_roles` (text[], nullable)

### RLS Policy Updates
- Add policies that filter resources/folders based on the user's role matching the visibility setting
- Admin and Super Admin always see everything regardless of visibility

### UI for Access Control
- When creating/editing a folder or uploading a file, show a "Visibility" dropdown:
  - Everyone (default)
  - Admin Only
  - Teachers Only
  - Students Only
  - Custom (multi-select role picker)
- Small lock/eye icon on cards indicating restricted access

---

## File Changes

| File | Action |
|------|--------|
| `src/components/resources/FolderItem.tsx` | Full redesign: fixed-height cards, tooltip for names, single-click open, item count badge, visibility indicator |
| `src/components/resources/FileItem.tsx` | Full redesign: fixed-height cards, type badge pill, tooltip for names, visibility indicator |
| `src/pages/Resources.tsx` | Grid layout fix (4 cols max), section headers for Folders/Files, folder item counts, mobile optimization |
| `src/components/resources/ResourcesBreadcrumb.tsx` | Minor polish for mobile |
| Migration SQL | Add `visibility` and `visible_to_roles` columns to both `resources` and `folders` tables |

---

## Technical Details

### Grid CSS Change (Resources.tsx)
```text
Current:  grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
Proposed: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4
```

### Card Height Consistency
- Grid cards: fixed `h-[180px]` with flexbox column layout
- Icon area: `flex-1` to absorb space
- Text area: fixed at bottom with `truncate`

### Folder Item Count
- Query folders with a count of child items (subfolders + files) using a subquery or separate lookup
- Display as small badge: "5 items"

### Single Click for Folders
- Change `onDoubleClick` to `onClick` for folder navigation
- Keep `onClick` for file opening

### Tooltip for Long Names
- Wrap card name in `<Tooltip>` showing full name on hover/long-press
- Grid view: single-line `truncate` (not `line-clamp-2`)

### Migration SQL
```sql
ALTER TABLE public.resources 
  ADD COLUMN visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN visible_to_roles text[];

ALTER TABLE public.folders 
  ADD COLUMN visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN visible_to_roles text[];
```

### Implementation Sequence
1. Database migration (visibility columns)
2. Redesign FolderItem.tsx and FileItem.tsx with new card layout
3. Update Resources.tsx with grid fix, section headers, folder counts
4. Add visibility selector to upload/create dialogs
5. Update RLS policies for role-based filtering
6. Mobile optimization pass

