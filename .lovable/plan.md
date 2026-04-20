

## Merge Identity into ID column — Division-colored role icons

### What changes (User Management list only)

**1. Delete the IDENTITY column entirely.** Move its content into the existing ID column as a single sleek pill.

**2. New ID + Identity Pill design:**
- White background, slight rounded corners (`rounded-md`, ~6px — edgy/classy, not pill-round)
- Subtle 3D look: thin border + soft shadow (`shadow-sm border border-border/60`)
- **Fixed width** sized to fit ID (12–13 chars) + up to **8 role icons** without reflow
- Layout inside pill: `[ID text] · [icon] [icon] [icon] …`
- Monospace font for ID portion so all rows align

**3. Division-colored role icons (the core fix):**

Role icon **color comes from the division**, not the role. One icon per (role × division) pairing. A student in both Group + 1:1 shows two student icons in two different colors.

Division color tokens (already in CSS):
- 1:1 Mentorship → blue `--division-one-to-one`
- Group Academy → emerald `--division-group`
- Recorded → amber `--division-recorded`
- No division / admin-only → neutral slate

**4. Role icon set (solid, filled, visible):**

| Role | Icon | Notes |
|---|---|---|
| Student | `GraduationCap` | graduation cap (was wrongly used for teacher) |
| Teacher | `UserCog` or `Briefcase` | teacher = professional, NOT a cap |
| Parent | `Heart` (filled) | |
| Admin | `Shield` (filled) | |
| Super Admin | `Crown` (filled) | |
| Examiner | `ClipboardCheck` | |

All rendered with `fill="currentColor"` style + `strokeWidth={2.25}` so the division color reads as a solid shape, not a thin outline.

**5. Multi-division logic per user:**
- Build a list of `{role, divisionKind}` pairs from the user's assignments/enrollments/contexts
- Render one colored icon per pair (deduped)
- Example: Ali = Student in Group + Student in 1:1 → 🎓(emerald) 🎓(blue)
- Example: Sara = Teacher in 1:1 + Admin → 👔(blue) 🛡(slate)
- Cap visible icons at 8; if more, show `+N` chip

**6. Tooltip on each icon:** "Student — Group Academy", "Teacher — 1:1 Mentorship", etc.

**7. Status dot stays** at far left of row (8px, unchanged from last pass).

**8. Legend update:** Reword to reflect new rule — "Icon = role · Color = division". Show the division color swatches and the role icon glyphs separately.

### Visual mock of one row

```text
●  [ AQT-00042 · 🎓 🎓 ]  Ali Khan · ali@…   +92…   Karachi
status   ID + identity pill        name/email     phone  city
         (white, edgy, fixed-w)
```

### Files to edit

- `src/pages/UserManagement.tsx`
  - Remove `IDENTITY` column header + cell
  - Replace ID cell with new `<IdentityPill>` inline component
  - Build `identityPairs: {role, divisionKind}[]` per user from existing role + division data already fetched
  - Update legend copy + swatches
  - Keep existing filters (role, division, status, country) untouched

No new shared components, no schema changes, no other pages touched.

### Acceptance

- IDENTITY column gone; ID column now shows white pill with ID + colored role icons
- Pill width is consistent across all rows (no jitter when icon count varies up to 8)
- A student in two divisions shows two student icons in two different colors
- Teacher icon is no longer a graduation cap
- Hover tooltip names role + division per icon

