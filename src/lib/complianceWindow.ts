/**
 * Compliance highlighting window.
 *
 * From the compliance go-live date onwards, dashboards highlight ONLY the
 * current month's outstanding items (attendance not marked, monthly plans not
 * submitted). Anything older stays in the system and remains retrievable on
 * demand — it is simply no longer surfaced as an active alert.
 */
import { format, startOfMonth, subDays } from 'date-fns';

/** Date compliance tracking went live. Nothing before this is ever highlighted. */
export const COMPLIANCE_START_DATE = '2026-09-01';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** Latest of (current month start, compliance go-live) — the highlight window start. */
export function complianceWindowStart(now: Date = new Date()): string {
  const monthStart = iso(startOfMonth(now));
  return monthStart > COMPLIANCE_START_DATE ? monthStart : COMPLIANCE_START_DATE;
}

/**
 * A rolling lookback clamped so it never reaches before the highlight window.
 * Use for "last N days" metrics that must not be dragged down by legacy gaps.
 */
export function clampedLookback(days: number, now: Date = new Date()): string {
  const raw = iso(subDays(now, days));
  const floor = complianceWindowStart(now);
  return raw > floor ? raw : floor;
}

/** Backlog window start (pre-current-month), used only when explicitly retrieved. */
export function backlogWindowStart(days = 60, now: Date = new Date()): string {
  const raw = iso(subDays(now, days));
  return raw > COMPLIANCE_START_DATE ? raw : COMPLIANCE_START_DATE;
}
