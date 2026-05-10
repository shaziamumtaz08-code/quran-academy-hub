/**
 * Assignment Status Lifecycle — Single Source of Truth
 *
 * 4-status model: active | on_hold | completed | left
 * "Inactive" is auto-derived (never persisted) when a person has zero
 * non-terminal assignments. History is NEVER deleted. "Left" archives
 * the profile only.
 */

export type AssignmentStatus = 'active' | 'on_hold' | 'completed' | 'left';

export interface StatusRule {
  label: string;
  dotClass: string;
  indicatorKey: string;
  description: string;
  freezeAcademic: boolean;
  invoice: boolean;
  salary: boolean;
  scheduleVisible: boolean;
  requiresConfirmation: boolean;
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
  on_hold: {
    long: 'On Hold',
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
  } as StatusRule,
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

export const SALARY_LOOKUP_STATUSES: AssignmentStatus[] = ['active', 'completed'];
export const INVOICE_GENERATION_STATUSES: AssignmentStatus[] = ['active'];
export const NON_TERMINAL_STATUSES: AssignmentStatus[] = ['active', 'on_hold'];

export function isPersonInactive(assignments: { status: string }[]): boolean {
  if (!assignments || assignments.length === 0) return true;
  return !assignments.some((a) => NON_TERMINAL_STATUSES.includes(a.status as AssignmentStatus));
}

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
