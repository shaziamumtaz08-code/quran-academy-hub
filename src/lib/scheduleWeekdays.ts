import { format } from 'date-fns';

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAYS_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** First date on or after `from` that falls on the given weekday. */
export const nextDateOnWeekday = (day: string, from: Date = new Date()): string => {
  const target = DAY_INDEX[(day || '').toLowerCase()];
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  if (target === undefined) return format(base, 'yyyy-MM-dd');
  base.setDate(base.getDate() + ((target - base.getDay() + 7) % 7));
  return format(base, 'yyyy-MM-dd');
};

/** Last date on or before `from` that falls on the given weekday. */
export const previousDateOnWeekday = (day: string, from: Date = new Date()): string => {
  const target = DAY_INDEX[(day || '').toLowerCase()];
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  if (target === undefined) return format(base, 'yyyy-MM-dd');
  base.setDate(base.getDate() - ((base.getDay() - target + 7) % 7));
  return format(base, 'yyyy-MM-dd');
};

/** True when the date lands on the class weekday (used to grey out other days). */
export const isOnWeekday = (date: Date, day: string): boolean => {
  const target = DAY_INDEX[(day || '').toLowerCase()];
  return target === undefined ? true : date.getDay() === target;
};
