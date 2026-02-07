import { format as fnsFormat, parseISO } from 'date-fns';

/**
 * Centralized date formatting utility.
 * All display dates use DD/MM/YYYY (day-first) format.
 */

/** Format a Date object for display: "dd MMM yyyy" e.g. "20 Feb 2026" */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fnsFormat(d, 'dd MMM yyyy');
}

/** Format a Date object with time: "dd MMM yyyy h:mm a" e.g. "01 Feb 2026 11:08 PM" */
export function formatDisplayDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fnsFormat(d, 'dd MMM yyyy h:mm a');
}

/** Format for long display: "dd MMMM yyyy" e.g. "01 February 2026" */
export function formatDisplayDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fnsFormat(d, 'dd MMMM yyyy');
}

/** Safe formatter for nullable date strings */
export function safeFormatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return formatDisplayDate(dateString);
  } catch {
    return '-';
  }
}

/** Safe formatter for nullable date strings (long format) */
export function safeFormatDateLong(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return formatDisplayDateLong(dateString);
  } catch {
    return '-';
  }
}

/** Format month+year from date string: "MMMM yyyy" e.g. "February 2026" */
export function formatMonthYear(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = parseISO(dateString);
    return fnsFormat(d, 'MMMM yyyy');
  } catch {
    return '-';
  }
}
