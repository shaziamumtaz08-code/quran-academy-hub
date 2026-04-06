

## Zoom License Priority & Type System

### Problem
Currently, `get_and_reserve_license` uses round-robin (`ORDER BY last_used_at ASC`), which spreads usage across all rooms equally. You want control over **which room gets picked first** and the ability to distinguish licensed (with recording) vs. free accounts.

### Solution

**1. Add two new columns to `zoom_licenses` table**

| Column | Type | Purpose |
|--------|------|---------|
| `license_type` | `text` (default `'licensed'`) | Values: `licensed`, `basic` (free). Helps identify which rooms have recording capability |
| `priority` | `integer` (default `0`) | Lower number = higher priority. Rooms with same priority fall back to round-robin |

**2. Add an allocation mode setting**

Add a `zoom_allocation_mode` column to the `organization_settings` table (or create a simple `system_settings` key-value table if none exists). Values:
- `priority` — Always pick the lowest-priority available room first
- `round_robin` — Current behavior, spread evenly across all rooms

**3. Update `get_and_reserve_license` RPC**

```text
IF mode = 'priority':
  ORDER BY priority ASC, created_at ASC
ELSE (round_robin):
  ORDER BY last_used_at ASC NULLS FIRST
```

**4. Update Zoom Management UI — Edit Dialog**

Add to the existing edit dialog:
- **License Type** dropdown: `Licensed` / `Basic (Free)`
- **Priority** number input (1, 2, 3...) with helper text: "Lower number = used first"

Show a badge on each room card: green "Licensed" or gray "Basic".

**5. Update Zoom Management UI — Settings Section**

Add a small settings card at the top of the Rooms tab:
- **Allocation Mode** dropdown: "Priority-based" / "Round Robin (random)"
- Brief description of each mode

### Files Changed

| File | Change |
|------|--------|
| Migration | Add `license_type`, `priority` columns to `zoom_licenses`. Create `system_settings` table for allocation mode |
| Migration | Update `get_and_reserve_license` function to read allocation mode and sort accordingly |
| `src/pages/ZoomManagement.tsx` | Add type/priority fields to edit dialog, add allocation mode setting card, show badges on room cards |

### Summary
- Room 1 and 2 (licensed, with recording) get priority 1 — system picks them first
- Room 3-5 (basic/free) get priority 2 — only used when priority 1 rooms are busy
- Admin can switch to round-robin anytime via a dropdown setting

