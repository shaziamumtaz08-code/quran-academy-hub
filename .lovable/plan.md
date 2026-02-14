

## Invoice Table Label Tweaks

Two small text changes in `src/pages/Payments.tsx`:

### 1. Rename "Pending" status badge to "Pay"
- In `getStatusBadge()` (line 107), change the default case label from `Pending` to `Pay` so it reads consistently with the Pay button beside it.

### 2. Rename "Actions" column header
- On line 893, change `Actions` to a less generic title -- using the ellipsis menu icon pattern, rename it to **"Manage"** (or remove the text entirely). "Manage" keeps it clear without conflicting visually with the "Pay" button and the three-dot menu in the same column.

### Technical Details

**File:** `src/pages/Payments.tsx`

- **Line 107:** `<Clock className="h-3 w-3" /> Pending` changes to `<Clock className="h-3 w-3" /> Pay`
- **Line 893:** `<TableHead className="text-center w-[160px]">Actions</TableHead>` changes to `<TableHead className="text-center w-[160px]">Manage</TableHead>`

No other files or logic affected.
