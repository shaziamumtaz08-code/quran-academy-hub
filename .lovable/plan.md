

## Plan: Compact Next Class Block + Remove Dead Space

### Problem
1. The **Next Class** card is too tall — the countdown tiles (Days/Hrs/Mins) are large squares stacked below the name, wasting vertical space.
2. There is excessive grey/empty space on both desktop and mobile views between the breadcrumb area and the actual dashboard content.

### Changes

#### 1. Redesign NextClassCountdown (`src/components/dashboard/teacher/NextClassCountdown.tsx`)

New layout — everything in **two rows** max:

```text
Row 1: ⏰ Next Class   |  Student Name  |  ▶ Start
Row 2: Quran · sun · 3:00 PM  |  [2d] [5h] [09m]  (slim pill boxes)
```

- **Row 1**: Label + student name on the left, Start button on the right — all in one line.
- **Row 2**: Subject/day/time info on the left, countdown in slim **rectangular pill** boxes (`px-2.5 py-1 rounded-md`) inline on the right. Each pill shows value + label side-by-side (e.g. `2d  5h  09m`) instead of stacked number+label.
- Overall padding reduced to `px-3 py-2.5`, border-radius kept at `rounded-2xl`.
- This cuts the block height roughly in half.

#### 2. Remove dead space on desktop (`src/components/dashboard/TeacherDashboard.tsx`)

- Reduce `space-y-3` to `space-y-2` for tighter widget spacing.
- The greeting bar already exists at the top — no structural changes needed there, but reduce its padding slightly (`py-1.5`).

#### 3. Remove dead space on mobile

- The mobile top bar is `fixed` with `pt-16` content offset. Reduce to `pt-14` since the top bar is compact enough.
- Reduce `pb-24` to `pb-20` for bottom nav clearance.
- Tighten `space-y-3` to `space-y-2` on mobile as well.

### Files Modified
- `src/components/dashboard/teacher/NextClassCountdown.tsx` — complete UI restructure of the render block (lines 172-206)
- `src/components/dashboard/TeacherDashboard.tsx` — spacing/padding adjustments (line 144, 146)

