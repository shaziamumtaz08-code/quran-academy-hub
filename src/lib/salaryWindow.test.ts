import { describe, it, expect } from 'vitest';
import {
  SALARY_ASSIGNMENT_STATUSES,
  resolveAssignmentEnd,
  assignmentMonthWindow,
  isAssignmentActiveInMonth,
} from './salaryWindow';

const APR = ['2026-04-01', '2026-04-30'] as const;
const MAY = ['2026-05-01', '2026-05-31'] as const;
const JUN = ['2026-06-01', '2026-06-30'] as const;
const JUL = ['2026-07-01', '2026-07-31'] as const;

describe('salary assignment windows', () => {
  it('never drops ended assignments from the payable statuses', () => {
    expect(SALARY_ASSIGNMENT_STATUSES).toContain('left');
    expect(SALARY_ASSIGNMENT_STATUSES).toContain('completed');
    expect(SALARY_ASSIGNMENT_STATUSES).toContain('active');
  });

  it('treats end dates as month-granular', () => {
    expect(
      resolveAssignmentEnd({ status: 'left', status_effective_date: '2026-06-09' }),
    ).toBe('2026-06-30');
  });

  // Hira: enrolled April, left June -> paid Apr, May, Jun (full June), not July
  it('pays a left assignment for every month it was active', () => {
    const hira = {
      status: 'left',
      effective_from_date: '2026-04-01',
      status_effective_date: '2026-06-09',
    };
    expect(isAssignmentActiveInMonth(hira, ...APR)).toBe(true);
    expect(isAssignmentActiveInMonth(hira, ...MAY)).toBe(true);
    expect(isAssignmentActiveInMonth(hira, ...JUN)).toBe(true);
    expect(isAssignmentActiveInMonth(hira, ...JUL)).toBe(false);
  });

  // Neha: enrolled April, left May
  it('stops paying after the ending month', () => {
    const neha = {
      status: 'left',
      effective_from_date: '2026-04-15',
      status_effective_date: '2026-05-20',
    };
    expect(assignmentMonthWindow(neha, ...APR)).toEqual({
      dateFrom: '2026-04-15',
      dateTo: '2026-04-30',
    });
    expect(assignmentMonthWindow(neha, ...MAY)).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });
    expect(assignmentMonthWindow(neha, ...JUN)).toBeNull();
  });

  it('prorates a mid-month start', () => {
    const w = assignmentMonthWindow({ status: 'active', effective_from_date: '2026-04-19' }, ...APR);
    expect(w).toEqual({ dateFrom: '2026-04-19', dateTo: '2026-04-30' });
  });

  it('is inactive before it starts', () => {
    expect(
      isAssignmentActiveInMonth({ status: 'active', effective_from_date: '2026-05-01' }, ...APR),
    ).toBe(false);
  });

  it('explicit effective_to_date wins over status_effective_date', () => {
    expect(
      resolveAssignmentEnd({
        status: 'left',
        effective_to_date: '2026-05-10',
        status_effective_date: '2026-06-09',
      }),
    ).toBe('2026-05-31');
  });
});
