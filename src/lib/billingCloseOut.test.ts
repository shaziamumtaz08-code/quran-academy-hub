import { describe, it, expect } from 'vitest';
import { computeCloseOut, daysInMonthOf, monthKeyOf } from './billingCloseOut';

describe('billing close-out proration', () => {
  it('charges the full month when the plan runs the whole month', () => {
    const r = computeCloseOut({ monthlyFee: 6000, effectiveFrom: '2026-06-01', closeDate: '2026-08-31' });
    expect(r.activeDays).toBe(31);
    expect(r.earned).toBe(6000);
    expect(r.isProrated).toBe(false);
  });

  it('prorates a mid-month leave date (Saadin / Sudaim case)', () => {
    const r = computeCloseOut({
      monthlyFee: 6000,
      effectiveFrom: '2026-08-03',
      closeDate: '2026-08-10',
      paidFinalMonth: 5612.9,
    });
    expect(r.activeDays).toBe(8); // 3rd through 10th inclusive
    expect(r.earned).toBe(1548.39);
    expect(r.creditDue).toBe(4064.51);
  });

  it('handles a same-day start and close', () => {
    const r = computeCloseOut({ monthlyFee: 3100, effectiveFrom: '2026-05-14', closeDate: '2026-05-14' });
    expect(r.activeDays).toBe(1);
    expect(r.earned).toBe(100);
  });

  it('handles month boundaries: close on the 1st', () => {
    const r = computeCloseOut({ monthlyFee: 3000, effectiveFrom: '2026-01-15', closeDate: '2026-04-01' });
    expect(r.activeDays).toBe(1);
    expect(r.earned).toBe(100);
    expect(r.monthKey).toBe('2026-04');
  });

  it('handles February in a non-leap year', () => {
    expect(daysInMonthOf('2026-02-10')).toBe(28);
    const r = computeCloseOut({ monthlyFee: 2800, effectiveFrom: '2026-02-01', closeDate: '2026-02-14' });
    expect(r.activeDays).toBe(14);
    expect(r.earned).toBe(1400);
  });

  it('handles February in a leap year', () => {
    expect(daysInMonthOf('2028-02-10')).toBe(29);
    const r = computeCloseOut({ monthlyFee: 2900, effectiveFrom: '2028-02-01', closeDate: '2028-02-29' });
    expect(r.activeDays).toBe(29);
    expect(r.earned).toBe(2900);
    expect(r.isProrated).toBe(false);
  });

  it('never returns a negative credit when the family underpaid', () => {
    const r = computeCloseOut({ monthlyFee: 6000, effectiveFrom: '2026-08-01', closeDate: '2026-08-31', paidFinalMonth: 1000 });
    expect(r.creditDue).toBe(0);
  });

  it('rolls already-paid future months into the credit', () => {
    const r = computeCloseOut({
      monthlyFee: 4000,
      effectiveFrom: '2026-09-01',
      closeDate: '2026-09-15',
      paidFinalMonth: 4000,
      paidAfterClose: 4000,
    });
    expect(r.earned).toBe(2000);
    expect(r.creditDue).toBe(6000);
  });

  it('clamps a close date that precedes the plan start to zero earned', () => {
    const r = computeCloseOut({ monthlyFee: 5000, effectiveFrom: '2026-07-20', closeDate: '2026-07-10' });
    expect(r.activeDays).toBe(0);
    expect(r.earned).toBe(0);
  });

  it('derives the correct month key', () => {
    expect(monthKeyOf('2026-12-31')).toBe('2026-12');
  });
});
