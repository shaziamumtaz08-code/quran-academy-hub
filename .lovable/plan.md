# Plan: Site-wide navigation persistence + sticky horizontal scrollbar

Two cross-cutting UX fixes applied consistently across the admin app.

---

## Part 1 — Persist tab/sub-view state across tab switch & refresh

### Root causes to eliminate
1. Selected month / user / record / sub-tab held only in `useState`, so remount = reset.
2. `useQuery` refetch-on-window-focus can re-trigger effects that reset local selection to defaults.
3. Sub-views not reflected in URL, so refresh drops the user back to the module's landing view.

### Approach — one shared pattern everywhere
Introduce a tiny helper hook `useUrlState` (wrapper around `useSearchParams`) that behaves like `useState` but reads/writes a query param. Every place currently doing:

```ts
const [month, setMonth] = useState(currentMonth);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [tab, setTab] = useState("overview");
```

becomes:

```ts
const [month, setMonth] = useUrlState("month", currentMonth);
const [selectedId, setSelectedId] = useUrlState("id", null);
const [tab, setTab] = useUrlState("tab", "overview");
```

This guarantees:
- Refresh → URL still has `?month=2026-05&id=abc&tab=payroll` → same view rehydrates.
- Browser tab switch → nothing resets; even if the component remounts it reads from URL.
- Back/forward buttons work naturally.

### Guarding "reset on focus" behavior
Audit for:
- `useEffect(() => { setX(default) }, [])` that runs on remount and clobbers URL state → change to read URL first.
- React Query defaults: set `refetchOnWindowFocus: false` **only on queries that reset UI selection via `onSuccess`**. Keep it on for pure data.
- Any `visibilitychange` / `focus` listeners that reset selection → remove.

### Pages to update (audit list)
Modules with inner sub-views identified from the codebase:

- Finance: `FinanceLanding`, `SalaryEngine`, `StaffSalarySetup`, `TeacherPayouts`, `CashAdvances`, `Expenses`, `FinanceSetup` — persist `?month=`, `?teacher=`, `?tab=`.
- Reports: `Reports`, `ReportsLanding`, `StudentReports`, `TeacherPerformance`, `StudentEngagement` — persist `?range=`, `?tab=`, `?student=`.
- People: `Students`, `Teachers`, `Parents`, `PeopleLanding`, `HolisticUserProfileDrawer` — persist `?userId=` for open drawer, `?tab=` inside drawer.
- Assignments / Schedules: `AssignmentDetailDialog`, `TransferAssignmentDialog`, `MonthlyCalendarView`, `DailySlotCalendar` — persist `?assignmentId=`, `?date=`.
- Hub / Work Hub: `WorkHub`, `TicketDetail`, `TaskDetailDialog` — persist `?ticket=`, `?task=`, `?tab=`.
- Courses / Teaching: `Courses`, `CourseCatalog`, `TeachingOS*` pages — persist `?courseId=`, `?sessionId=`, `?phase=`.
- Communication: `CommunicationLanding`, `GroupChat`, `WhatsAppInbox` — persist `?group=`, `?thread=`.
- Settings: `SettingsLanding`, `OrganizationSettings`, `AuthenticationSettings` — persist `?tab=`.

`HubPageShell` already reads `tab` from the URL — extend the same pattern to the rest.

### Unsaved edit protection
For form-heavy pages (assignment edit, salary sheet edit, report card form, template builder):
- New hook `useDraftPersistence(key, values)` that writes form state to `sessionStorage` on change (debounced) and rehydrates on mount.
- Clear the draft on successful save/cancel.

---

## Part 2 — Sticky horizontal scrollbar for wide tables

### Approach
One shared component `<StickyScrollTable>` that wraps a wide table and adds a floating horizontal scrollbar synced to the table's `scrollLeft`.

Implementation:
- Wrapper `div` with `overflow-x-auto` holds the table (as today).
- Sibling floating bar: `position: sticky; bottom: 0` inside the same scroll container, or `position: fixed; bottom: 0` visible only while the table is in the viewport (IntersectionObserver).
- Inner spacer div width = table's `scrollWidth`; two-way scroll sync via `onScroll` handlers on both the table wrapper and the sticky bar.
- Auto-hide when table fits within viewport width.

### Where it's applied
Replace the current `<div className="overflow-x-auto">` wrapper on every wide admin table:

- `TeacherPerformance.tsx`, `StudentEngagement.tsx`
- `Students.tsx`, `Teachers.tsx`, `Parents.tsx`
- `SalaryEngine`, `StaffSalarySetup`, `TeacherPayouts`, `CashAdvances`, `Expenses`
- `Reports` module tables
- Assignments tables, `MonthlyCalendarView` grid
- Work Hub `TicketList`
- Any other `overflow-x-auto` table wrapper found by ripgrep

A single ripgrep for `overflow-x-auto` on `<table` neighbors will produce the exhaustive list; each site gets the component swapped in.

---

## Technical details

**New files**
- `src/hooks/useUrlState.ts` — typed URL-param state hook (string/number/enum overloads).
- `src/hooks/useDraftPersistence.ts` — sessionStorage draft sync.
- `src/components/ui/sticky-scroll-table.tsx` — wide-table wrapper with floating scrollbar.

**Edits**
- Swap `useState` → `useUrlState` on every listed page for selection/tab/month/id state.
- Swap `<div className="overflow-x-auto">…<table>` → `<StickyScrollTable>…<table>` on every wide-table page.
- Remove any `refetchOnWindowFocus`-triggered UI resets; keep data refetches.
- Wire `useDraftPersistence` into the four heavy edit forms.

**Non-goals**
- No visual/theme changes.
- No data-model or RLS changes.
- No changes to backend/edge functions.

Estimated scope: ~3 new files + edits across ~25 existing files (mostly small swaps).
