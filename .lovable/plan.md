

## Next Class Countdown Bug Fix

### Root Cause

The `schedules` table stores `day_of_week` as lowercase strings (`monday`, `tuesday`, `wednesday`, etc.), but `NextClassCountdown.tsx` line 8 defines:

```
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', ...];
```

At line 44, the lookup `DAY_NAMES.indexOf(dayName)` always returns `-1` because `"monday" !== "Monday"`. This causes `buildNextOccurrence` to return a fallback date 7 days out, making the countdown permanently wrong.

### Fix

**File:** `src/components/dashboard/teacher/NextClassCountdown.tsx`

**Change 1** — Normalize the `day_of_week` value before lookup by capitalizing the first letter:

```typescript
// Line 44: change from
const targetDayIndex = DAY_NAMES.indexOf(dayName);
// to
const targetDayIndex = DAY_NAMES.indexOf(dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase());
```

This single-line fix ensures `"monday"` → `"Monday"` matches the `DAY_NAMES` array correctly, and the countdown will sync to real schedule data.

**Also normalize the display** on line 195 where `dayOfWeek` is shown — capitalize it for clean UI output.

### No other files or DB changes needed.

