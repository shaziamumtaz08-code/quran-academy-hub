/**
 * Canonical `attendance.class_date` resolution.
 *
 * A class slot is defined in the TEACHER's local frame: `schedules.day_of_week`
 * and `schedules.teacher_local_time` are teacher-local. For students in far
 * timezones (e.g. US), the same class can fall on a different calendar day on
 * the student's side. To keep attendance, schedules and the "Missing
 * Attendance" report in the same frame, every write path must store the
 * TEACHER-local date — never the browser/UTC date.
 */
import { zonedParts, DEFAULT_ACADEMY_TZ } from '@/hooks/useAcademyTimezone';

export { DEFAULT_ACADEMY_TZ };

/** Teacher-local calendar date (YYYY-MM-DD) for the given instant. */
export function teacherLocalClassDate(
  teacherTimezone?: string | null,
  date: Date | string = new Date(),
): string {
  // A YYYY-MM-DD value selected from a teacher-frame schedule is already the
  // canonical calendar date. Do not reinterpret it through the browser's zone.
  if (typeof date === 'string') return date.substring(0, 10);
  return zonedParts(date, teacherTimezone || DEFAULT_ACADEMY_TZ).dateKey;
}

/** Teacher-local wall-clock time (HH:mm) for the given instant. */
export function teacherLocalClassTime(
  teacherTimezone?: string | null,
  date: Date = new Date(),
): string {
  const p = zonedParts(date, teacherTimezone || DEFAULT_ACADEMY_TZ);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Teacher-local weekday name (lowercase) — matches `schedules.day_of_week`. */
export function teacherLocalDayName(
  teacherTimezone?: string | null,
  date: Date = new Date(),
): string {
  return zonedParts(date, teacherTimezone || DEFAULT_ACADEMY_TZ).weekday;
}
