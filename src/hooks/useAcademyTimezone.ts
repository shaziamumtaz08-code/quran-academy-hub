import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_ACADEMY_TZ = 'Asia/Karachi';

/**
 * Resolves the timezone that schedule wall-clock times (schedules.teacher_local_time)
 * should be interpreted in: the signed-in user's profile timezone, falling back to
 * the academy default. Same convention used by attendance + schedule views.
 */
export function useAcademyTimezone() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['academy-timezone', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user!.id)
        .maybeSingle();
      return data?.timezone || DEFAULT_ACADEMY_TZ;
    },
  });
  return data || DEFAULT_ACADEMY_TZ;
}

/** Wall-clock parts of `date` as seen in `timeZone`. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    weekday: get('weekday').toLowerCase(),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute,
    second: Number(get('second')),
    minutesOfDay: hour * 60 + minute,
  };
}

/** Current day name (lowercase) in the given timezone. */
export function zonedDayName(timeZone: string, date = new Date()) {
  return zonedParts(date, timeZone).weekday;
}

/** Start of "today" in the given timezone, as a UTC instant. */
export function zonedStartOfDay(timeZone: string, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return new Date(date.getTime() - ((p.hour * 3600 + p.minute * 60 + p.second) * 1000));
}

/** Formatted clock label, e.g. "11:20 PM". */
export function zonedClockLabel(timeZone: string, date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Formatted date label, e.g. "Monday, 27 Jul 2026". */
export function zonedDateLabel(timeZone: string, date = new Date()) {
  return date.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
