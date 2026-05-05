Swap the status icon in `src/pages/UserManagement.tsx` from `Activity` to `Power` (option 8).

Changes:
1. Update the `lucide-react` import: replace `Activity` with `Power`.
2. In `UserStatusPopover`, replace the `<Activity />` trigger icon with `<Power />` (keep same size, color tinting via `STATUS_ICON_COLOR`, and tooltip/aria-label).
3. No other behavior changes — popover content, per-role selects, "Apply to all roles", Archive/Restore actions all remain identical.