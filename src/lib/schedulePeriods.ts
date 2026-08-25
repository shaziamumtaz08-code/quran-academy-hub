export type SchedulePeriodType = 'permanent' | 'temporary';

export interface SchedulePeriod {
  id: string;
  schedule_id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  period_type: SchedulePeriodType;
  effective_from: string;
  effective_to: string | null;
  change_reason: string;
  created_at: string;
}

export interface RecurringSchedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active?: boolean;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function shiftWeekday(dayOfWeek: string, dayOffset: number): string {
  const index = DAY_NAMES.indexOf(dayOfWeek.toLowerCase());
  if (index < 0) return dayOfWeek.toLowerCase();
  return DAY_NAMES[(index + dayOffset + 7) % 7];
}

/**
 * Convert schedule rows whose weekday is stored in the student's frame into
 * the teacher's frame before date-based resolution. The caller supplies the
 * same time conversion used by Scheduling's Student/Teacher toggle.
 */
export function mapSchedulesToTeacherWeekdays<T extends RecurringSchedule>(
  schedules: T[],
  getDayOffset: (schedule: T) => number,
): T[] {
  return schedules.map((schedule) => ({
    ...schedule,
    day_of_week: shiftWeekday(schedule.day_of_week, getDayOffset(schedule)),
  }));
}

export function mapPeriodsToTeacherWeekdays<T extends SchedulePeriod>(
  periods: T[],
  getDayOffset: (period: T) => number,
): T[] {
  return periods.map((period) => ({
    ...period,
    day_of_week: shiftWeekday(period.day_of_week, getDayOffset(period)),
  }));
}

export function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveScheduleForDate<T extends RecurringSchedule>(
  schedule: T,
  periods: SchedulePeriod[],
  date: Date | string,
): T & { effectivePeriod?: SchedulePeriod } {
  const dateValue = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const iso = typeof date === 'string' ? date : localIsoDate(dateValue);
  const weekday = DAY_NAMES[dateValue.getDay()];
  const candidates = periods
    .filter((period) =>
      period.schedule_id === schedule.id &&
      period.day_of_week.toLowerCase() === weekday &&
      period.effective_from <= iso &&
      (!period.effective_to || period.effective_to >= iso),
    )
    .sort((a, b) => {
      if (a.period_type !== b.period_type) return a.period_type === 'temporary' ? -1 : 1;
      return b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at);
    });
  const period = candidates[0];
  if (!period) return schedule;
  return {
    ...schedule,
    student_local_time: period.student_local_time,
    teacher_local_time: period.teacher_local_time,
    duration_minutes: period.duration_minutes,
    effectivePeriod: period,
  };
}

export function resolveSchedulesForDate<T extends RecurringSchedule>(
  schedules: T[],
  periods: SchedulePeriod[],
  date: Date | string,
): Array<T & { effectivePeriod?: SchedulePeriod }> {
  const dateValue = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const weekday = DAY_NAMES[dateValue.getDay()];
  return schedules
    .filter((schedule) => schedule.day_of_week.toLowerCase() === weekday && schedule.is_active !== false)
    .map((schedule) => resolveScheduleForDate(schedule, periods, date));
}