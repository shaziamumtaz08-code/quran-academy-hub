/**
 * Single source of truth for attendance status normalisation.
 *
 * The `attendance.status` column stores role-qualified values
 * ('student_absent', 'teacher_leave', 'student_rescheduled', …) as well as
 * legacy plain values ('present', 'absent', 'rescheduled', 'holiday').
 * Any module that buckets attendance (salary sheets, reports, dashboards)
 * must normalise through here — comparing against the bare 'absent' / 'leave'
 * strings silently drops the role-qualified rows and under-reports.
 */

export type NormalizedAttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'rescheduled'
  | 'holiday'
  | 'none';

export function normalizeAttendanceStatus(
  raw?: string | null,
): NormalizedAttendanceStatus {
  if (!raw) return 'none';
  const s = String(raw).toLowerCase().trim();

  if (s === 'present' || s === 'late' || s === 'attended') return 'present';
  if (s === 'holiday' || s === 'off' || s === 'off_day') return 'holiday';
  if (s.includes('reschedul')) return 'rescheduled';
  if (s.includes('leave')) return 'leave';
  if (s.includes('absent')) return 'absent';
  return 'none';
}

export const isPresentStatus = (s?: string | null) => normalizeAttendanceStatus(s) === 'present';
export const isAbsentStatus = (s?: string | null) => normalizeAttendanceStatus(s) === 'absent';
export const isLeaveStatus = (s?: string | null) => normalizeAttendanceStatus(s) === 'leave';

/** True when the class did not run and it was nobody's fault (leave/holiday). */
export const isExcusedStatus = (s?: string | null) => {
  const n = normalizeAttendanceStatus(s);
  return n === 'leave' || n === 'holiday';
};

/** Who the absence/leave belongs to, when the raw status carries a role prefix. */
export function attendanceStatusParty(raw?: string | null): 'student' | 'teacher' | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.startsWith('student')) return 'student';
  if (s.startsWith('teacher')) return 'teacher';
  return null;
}

export function attendanceStatusLabel(raw?: string | null): string {
  const party = attendanceStatusParty(raw);
  const n = normalizeAttendanceStatus(raw);
  const base =
    n === 'present' ? 'Present'
    : n === 'absent' ? 'Absent'
    : n === 'leave' ? 'Leave'
    : n === 'rescheduled' ? 'Rescheduled'
    : n === 'holiday' ? 'Holiday / Off Day'
    : 'Not marked';
  if (!party || n === 'present' || n === 'holiday' || n === 'none') return base;
  return `${party === 'student' ? 'Student' : 'Teacher'} ${base.toLowerCase()}`;
}
