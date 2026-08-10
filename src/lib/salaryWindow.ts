import { endOfMonth, format, parseISO } from 'date-fns';

/**
 * SINGLE SOURCE OF TRUTH for "which months does an assignment earn salary in".
 *
 * Business rules (do not weaken without updating salaryWindow.test.ts):
 * 1. Ended assignments ('left' / 'completed') STILL earn salary for every month they
 *    were active. They must never be filtered out of historical sheets.
 * 2. End dates are MONTH-GRANULAR: an assignment ending on any day of June is paid the
 *    whole of June.
 * 3. When no explicit effective_to_date exists, status_effective_date is the end date.
 */
export const SALARY_ASSIGNMENT_STATUSES = ['active', 'completed', 'left'] as const;

export interface AssignmentWindowInput {
  status?: string | null;
  effective_from_date?: string | null;
  effective_to_date?: string | null;
  status_effective_date?: string | null;
}

/** Normalised end date (yyyy-MM-dd) for an assignment, or null if open-ended. */
export function resolveAssignmentEnd(assign: AssignmentWindowInput): string | null {
  const rawEnd =
    assign.effective_to_date ||
    ((assign.status === 'left' || assign.status === 'completed')
      ? assign.status_effective_date
      : null);
  if (!rawEnd) return null;
  return format(endOfMonth(parseISO(rawEnd)), 'yyyy-MM-dd');
}

/** Clipped [from, to] window of an assignment inside a month, or null if inactive that month. */
export function assignmentMonthWindow(
  assign: AssignmentWindowInput,
  monthStart: string,
  monthEnd: string,
): { dateFrom: string; dateTo: string } | null {
  const effectiveFrom = assign.effective_from_date || monthStart;
  const effectiveTo = resolveAssignmentEnd(assign) || monthEnd;
  const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
  const dateTo = effectiveTo < monthEnd ? effectiveTo : monthEnd;
  if (dateFrom > dateTo) return null;
  return { dateFrom, dateTo };
}

/** True when the assignment earned salary in the given month. */
export function isAssignmentActiveInMonth(
  assign: AssignmentWindowInput,
  monthStart: string,
  monthEnd: string,
): boolean {
  return assignmentMonthWindow(assign, monthStart, monthEnd) !== null;
}
