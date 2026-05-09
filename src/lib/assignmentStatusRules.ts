/**
 * Assignment Status Lifecycle — Single Source of Truth
 *
 * Matrix governs attendance/planning/exam, invoice, and salary behavior.
 * "Inactive" is auto-derived (no stored row) when a person has zero
 * non-terminal assignments. Never persist 'inactive' to the database.
 *
 * History is NEVER deleted. "Left" archives the profile only.
 */

export type AssignmentStatus = 'active' | 'paused' | 'on_hold' | 'completed' | 'left';

export interface StatusRule {
  label: string;
  /** Tailwind dot color class (bg-*). */
  dotClass: string;
  /** Matches StatusIndicator variant key. */
  indicatorKey: string;
  description: string;
  /** Allow attendance, planning markers, exams, Zoom join. */
  freezeAcademic: boolean;
  /** Generate / honor recurring invoices. */
  invoice: boolean;
  /** Include in salary lookup queries. */
  salary: boolean;
  /** Show in active schedule views. */
  scheduleVisible: boolean;
  /** Requires confirmation modal + reason on transition into this state. */
  requiresConfirmation: boolean;
  /** Treat as terminal (no longer counted toward "active person"). */
  terminal: boolean;
}

export const ASSIGNMENT_STATUS_RULES: Record<AssignmentStatus, StatusRule> = {
  active: {
    label: 'Active',
    dotClass: 'bg-emerald-500',
    indicatorKey: 'active',
    description: 'Fully live · attendance, billing & salary on',
    freezeAcademic: false,
    invoice: true,
    salary: true,
    scheduleVisible: true,
    requiresConfirmation: false,
    terminal: false,
  },
  paused: {
    label: 'Paused',
    dotClass: 'bg-amber-500',
    indicatorKey: 'paused',
    description: 'Short break · billing & salary continue · attendance frozen',
    freezeAcademic: true,
    invoice: true,
    salary: true,
    scheduleVisible: true,
    requiresConfirmation: true,
    terminal: false,
  },
  on_hold: {
    label: 'On Hold',
    dotClass: 'bg-orange-500',
    indicatorKey: 'on_hold',
    description: 'Extended break · billing & salary suspended',
    freezeAcademic: true,
    invoice: false,
    salary: false,
    scheduleVisible: true,
    requiresConfirmation: true,
    terminal: false,
  },
  completed: {
    label: 'Completed',
    dotClass: 'bg-blue-500',
    indicatorKey: 'completed',
    description: 'Course finished · history & salary preserved',
    freezeAcademic: true,
    invoice: false,
    salary: true,
    scheduleVisible: false,
    requiresConfirmation: true,
    terminal: true,
  },
  left: {
    label: 'Left',
    dotClass: 'bg-rose-600',
    indicatorKey: 'left',
    description: 'No longer enrolled · profile archived · history preserved',
    freezeAcademic: true,
    invoice: false,
    salary: true,
    scheduleVisible: false,
    requiresConfirmation: true,
    terminal: true,
  },
};

/** Statuses that count toward salary engine inclusion. */
export const SALARY_LOOKUP_STATUSES: AssignmentStatus[] = ['active', 'paused', 'completed'];

/** Statuses that allow recurring invoice generation. */
export const INVOICE_GENERATION_STATUSES: AssignmentStatus[] = ['active', 'paused'];

/** Statuses that count a person as still "engaged" (not Inactive). */
export const NON_TERMINAL_STATUSES: AssignmentStatus[] = ['active', 'paused', 'on_hold'];

/** Compute whether a profile should be auto-derived as Inactive. */
export function isPersonInactive(assignments: { status: string }[]): boolean {
  if (!assignments || assignments.length === 0) return true;
  return !assignments.some((a) => NON_TERMINAL_STATUSES.includes(a.status as AssignmentStatus));
}

/** Whether the only remaining assignment of a person, after this transition, is terminal. */
export function shouldArchiveOnLeft(
  allAssignments: { id: string; status: string }[],
  changingId: string,
): boolean {
  return !allAssignments.some(
    (a) => a.id !== changingId && NON_TERMINAL_STATUSES.includes(a.status as AssignmentStatus),
  );
}

export function getStatusRule(status: string): StatusRule {
  return ASSIGNMENT_STATUS_RULES[status as AssignmentStatus] ?? ASSIGNMENT_STATUS_RULES.active;
}
