
# Responsive LMS Layout Overhaul

## Scope
Visual layout and navigation restructuring only. All existing data, routes, and functional components preserved.

## Phase 1 — Design Tokens & Global Styles
- Update CSS variables in `index.css` with new design tokens (navy, surface, text hierarchy, status pills)
- Update `tailwind.config.ts` with new token mappings
- Update typography: remove Amiri serif from headings, use system-ui/Inter weight 400/500 only

## Phase 2 — Desktop Shell (1024px+)
- **Rail** (56px, navy): Icon-only nav, always visible, tooltip on hover
- **Sidebar** (200px, white): Context-sensitive content per active section
- **Content Area** (flex-1, #f4f5f7): Sticky breadcrumb top bar, scrollable content
- Replace current `DashboardLayout.tsx` with new responsive shell
- Sidebar content changes per rail section (Home, Teaching, People, Finance, Communication, Settings)
- Course Detail sidebar replaces Teaching sidebar when inside a course

## Phase 3 — Mobile Layout (<768px)
- No rail, no sidebar — full-width single column
- Navy top bar (44px): centered title, bell + avatar right
- Fixed bottom tab bar (52px): Home, Teaching, People, Chat, More
- "More" opens bottom sheet with remaining nav items
- Cards stack 1-col with 10px gap

## Phase 4 — Tablet Layout (768–1023px)
- 56px navy rail (always visible)
- No persistent sidebar — rail icons open 200px slide-in drawer overlay
- No bottom tab bar
- 2-column card grid

## Phase 5 — Component Updates
- Hero dashboard banner (navy card with stats)
- Course cards (colored top border by subject, grid layout)
- Stat cards (4/2/2 col responsive grid)
- Status pills (global consistent styling)
- Remove horizontal tab bars from pages
- Remove "Community" label → "HUB"

## Key Files to Create/Modify
- `src/components/layout/AppShell.tsx` — new responsive shell (rail + sidebar + content)
- `src/components/layout/NavRail.tsx` — desktop/tablet icon rail
- `src/components/layout/AppSidebar.tsx` — context-sensitive sidebar
- `src/components/layout/MobileBottomNav.tsx` — mobile tab bar
- `src/components/layout/MobileTopBar.tsx` — mobile top bar
- `src/components/layout/MoreSheet.tsx` — mobile "More" bottom sheet
- `src/components/layout/DashboardLayout.tsx` — refactor to use new shell
- `src/index.css` — updated tokens
- `tailwind.config.ts` — updated config

## Constraints
- Preserve ALL routes in App.tsx
- Preserve ALL database logic
- Preserve ALL form components and data
- No functional changes — layout/style only
