

## Audit findings + `/my-dashboard` cleanup

### Audit of the referenced WorkHub message

You're right — I didn't actually deliver the WorkHub redesign in that earlier turn. The summary I wrote claimed dashboard-wide identity wiring (`RoleBadge` + `StatusDot` in connections graph, attendance rows, holistic profile drawer), but in this current session I cannot verify those edits ever shipped to the WorkHub dashboards specifically. The only thing that visibly changed in your account was the **task assignment dropdown for students** (likely a side-effect of role-aware assignment work). The WorkHub dashboards (Inbox, Sent, Tasks & Polls, ticket cards, role filters) were not touched.

I will not re-attempt that WorkHub work in this turn — you've asked for a single-file cleanup, and that is what I'll do. We can plan a proper WorkHub redesign separately once this is shipped.

### Is the `/my-dashboard` removal a better approach? Yes.

Confirmed by inspection:
- `/my-dashboard` renders `UnifiedDashboard.tsx` (817 lines) — courses, schedule, performance, divisions
- `/dashboard` renders role-specific dashboards (`StudentDashboard`, `TeacherDashboard`, etc.) which already cover the same ground for the active role
- Having both creates a duplicate "Home" surface and the sidebar literally lists "Dashboard" and "My Dashboard" back-to-back — confusing
- `NavRail` already aliases `/my-dashboard` as active when on `/dashboard`, proof they're treated as the same destination

Removing the duplicate is the correct call.

### Scope — strictly minimal

**One behavior**: delete the `/my-dashboard` surface and redirect it permanently to `/dashboard`. Remove every sidebar/nav reference to it.

### Files touched (4, all nav/route wiring — no business logic)

1. **`src/App.tsx`** (line 319)
   - Replace `<Route path="/my-dashboard" element={...UnifiedDashboard...} />` with `<Route path="/my-dashboard" element={<Navigate to="/dashboard" replace />} />`
   - Keeps any old bookmarks/links working.

2. **`src/components/layout/AppSidebar.tsx`** (line 34)
   - Remove the `{ label: 'My Dashboard', href: '/my-dashboard' }` item from `getHomeSidebar`.

3. **`src/components/layout/MobileBottomNav.tsx`** (line 37)
   - Change the "Calendar" tab `href` from `/my-dashboard` to `/schedules` (the real calendar page) so the icon doesn't dead-end into a redirect.

4. **`src/components/layout/NavRail.tsx`** (lines 50, 91)
   - Same swap: Calendar → `/schedules`.
   - Remove the `|| location.pathname === '/my-dashboard'` alias from `isActive` (no longer needed since the route just redirects).

### What is NOT touched

- `src/pages/UnifiedDashboard.tsx` — the file stays on disk (no imports break) but is no longer routed. Safer than deleting in case any deep link or future role wants to reuse it. If you want it deleted entirely, say the word and I'll remove the file too.
- All role dashboards, WorkHub, identity pills, drawers — untouched.

### Acceptance

- Visiting `/my-dashboard` immediately lands on `/dashboard` with no flash of the old UI
- "My Dashboard" no longer appears in the desktop sidebar
- Mobile bottom nav and desktop NavRail "Calendar" tab routes to `/schedules` (live calendar) instead of the dead duplicate
- No build errors, no other pages affected

