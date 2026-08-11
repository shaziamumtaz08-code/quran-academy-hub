/**
 * Billing close-out math.
 *
 * This mirrors — exactly — the proration used by the database function
 * `close_billing_plan`. It is intentionally separate from `salaryWindow.ts`:
 * salary rules are untouched by billing close-out.
 *
 * Rule (same as the platform-wide finance formula):
 *   earned = (net_recurring_fee / days_in_month) * active_days
 * where active_days counts from the later of (month start, plan effective_from)
 * through the billing close date, inclusive.
 */

export type PlanLifecycleStatus =
  | 'open'
  | 'pending_closure'
  | 'closed'
  | 'suspended'
  | 'superseded';

export const LIFECYCLE_LABELS: Record<PlanLifecycleStatus, string> = {
  open: 'Open',
  pending_closure: 'Pending closure',
  closed: 'Closed',
  suspended: 'Suspended',
  superseded: 'Superseded',
};

const toDate = (value: string | Date): Date => {
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

export const daysInMonthOf = (value: string | Date): number => {
  const d = toDate(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};

export const monthKeyOf = (value: string | Date): string => {
  const d = toDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CloseOutInput {
  /** Recurring monthly fee of the plan. */
  monthlyFee: number;
  /** Plan effective_from (ISO date). */
  effectiveFrom: string;
  /** Billing close date (ISO date) — inclusive, last billable day. */
  closeDate: string;
  /** Total already paid against the final month's invoice. */
  paidFinalMonth?: number;
  /** Amounts already paid on invoices AFTER the final month (rare). */
  paidAfterClose?: number;
}

export interface CloseOutResult {
  monthKey: string;
  daysInMonth: number;
  activeDays: number;
  /** Amount actually earned for the final billing month. */
  earned: number;
  /** Total paid that this close-out considers. */
  paid: number;
  /** Positive when the family paid more than was earned. */
  creditDue: number;
  /** True when the final month is a partial month. */
  isProrated: boolean;
}

export function computeCloseOut(input: CloseOutInput): CloseOutResult {
  const { monthlyFee, effectiveFrom, closeDate } = input;
  const close = toDate(closeDate);
  const from = toDate(effectiveFrom);
  const monthFirst = new Date(Date.UTC(close.getUTCFullYear(), close.getUTCMonth(), 1));
  const daysInMonth = daysInMonthOf(close);

  const activeFrom = from > monthFirst ? from : monthFirst;
  const rawDays = Math.floor((close.getTime() - activeFrom.getTime()) / 86400000) + 1;
  const activeDays = Math.max(0, Math.min(rawDays, daysInMonth));

  const earned = activeDays >= daysInMonth
    ? round2(monthlyFee)
    : round2((monthlyFee / daysInMonth) * activeDays);

  const paid = round2((input.paidFinalMonth || 0) + (input.paidAfterClose || 0));
  const creditDue = round2(Math.max(0, paid - earned));

  return {
    monthKey: monthKeyOf(close),
    daysInMonth,
    activeDays,
    earned,
    paid,
    creditDue,
    isProrated: activeDays !== daysInMonth,
  };
}
