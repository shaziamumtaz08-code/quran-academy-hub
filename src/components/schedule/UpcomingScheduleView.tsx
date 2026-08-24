import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, User } from 'lucide-react';
import { resolveSchedulesForDate, localIsoDate, SchedulePeriod } from '@/lib/schedulePeriods';
import { formatTime12h, getTimezoneAbbr } from '@/lib/timezones';
import { DEFAULT_ACADEMY_TZ } from '@/hooks/useAcademyTimezone';

export type ScheduleRange = 'today' | 'this_week' | 'next_week';

interface Props {
  mode: 'teacher' | 'student';
  range?: ScheduleRange;
}

function rangeDates(range: ScheduleRange): Date[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (range === 'today') return [today];
  // week starts Monday
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dow + (range === 'next_week' ? 7 : 0));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const total = ((h || 0) * 60 + (m || 0) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function UpcomingScheduleView({ mode, range = 'this_week' }: Props) {
  const { user } = useAuth();
  const { activeDivision } = useDivision();

  const { data, isLoading } = useQuery({
    queryKey: ['my-upcoming-schedule', mode, user?.id, activeDivision?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const column = mode === 'teacher' ? 'teacher_id' : 'student_id';
      let q = supabase
        .from('student_teacher_assignments')
        .select('id, student_id, teacher_id, subject_id')
        .eq(column, user!.id)
        .eq('status', 'active') as any;
      if (activeDivision?.id) q = q.eq('division_id', activeDivision.id);
      const { data: assignments, error } = await q;
      if (error) throw error;
      if (!assignments?.length) return { schedules: [], periods: [], overrides: [], people: {}, tz: {} };

      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: schedules } = await (supabase as any)
        .from('schedules')
        .select('*')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);

      const scheduleIds = (schedules || []).map((s: any) => s.id);
      const [{ data: periods }, { data: overrides }] = await Promise.all([
        scheduleIds.length
          ? (supabase as any).from('schedule_periods').select('*').in('schedule_id', scheduleIds)
          : Promise.resolve({ data: [] }),
        scheduleIds.length
          ? (supabase as any).from('schedule_overrides').select('*').in('schedule_id', scheduleIds)
          : Promise.resolve({ data: [] }),
      ]);

      const personIds = [
        ...new Set(
          assignments
            .map((a: any) => (mode === 'teacher' ? a.student_id : a.teacher_id))
            .filter(Boolean)
            .concat(user!.id),
        ),
      ] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, timezone')
        .in('id', personIds);

      const people: Record<string, string> = {};
      const tz: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        people[p.id] = p.full_name;
        tz[p.id] = p.timezone || DEFAULT_ACADEMY_TZ;
      });

      const assignMap = Object.fromEntries(assignments.map((a: any) => [a.id, a]));
      return {
        schedules: (schedules || []).map((s: any) => ({ ...s, assignment: assignMap[s.assignment_id] })),
        periods: (periods || []) as SchedulePeriod[],
        overrides: overrides || [],
        people,
        tz,
      };
    },
  });

  const days = useMemo(() => rangeDates(range), [range]);

  const grouped = useMemo(() => {
    if (!data) return [];
    return days.map((day) => {
      const iso = localIsoDate(day);
      const resolved = resolveSchedulesForDate(data.schedules as any[], data.periods, day);
      const items = resolved.map((s: any) => {
        const override = (data.overrides || []).find(
          (o: any) => o.schedule_id === s.id && o.original_date === iso,
        );
        return { ...s, movedAway: !!override, override };
      });
      // classes moved INTO this date from elsewhere
      const movedIn = (data.overrides || [])
        .filter((o: any) => o.new_date === iso)
        .map((o: any) => {
          const base = (data.schedules as any[]).find((s) => s.id === o.schedule_id);
          if (!base) return null;
          return {
            ...base,
            student_local_time: o.new_start_time?.slice(0, 5) || base.student_local_time,
            teacher_local_time: o.new_start_time?.slice(0, 5) || base.teacher_local_time,
            movedIn: true,
            override: o,
          };
        })
        .filter(Boolean);
      return { day, iso, items: [...items.filter((i: any) => !i.movedAway), ...movedIn] };
    });
  }, [data, days]);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  const total = grouped.reduce((sum, g) => sum + g.items.length, 0);
  if (total === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-base font-medium">No classes in this period</p>
        <p className="text-sm mt-1">Your schedule is set by the academy — contact admin for changes.</p>
      </div>
    );
  }

  const selfTz = data?.tz?.[user!.id] || DEFAULT_ACADEMY_TZ;

  return (
    <div className="space-y-5">
      {grouped.map(({ day, iso, items }) => (
        items.length === 0 ? null : (
          <div key={iso} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'long' })}
              </h3>
              <span className="text-xs text-muted-foreground">
                {day.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="grid gap-2">
              {items.map((s: any, idx: number) => {
                const counterpartId = mode === 'teacher' ? s.assignment?.student_id : s.assignment?.teacher_id;
                const counterpartName = (counterpartId && data?.people?.[counterpartId]) || 'Unknown';
                const counterpartTz = (counterpartId && data?.tz?.[counterpartId]) || DEFAULT_ACADEMY_TZ;
                const myTime = mode === 'teacher' ? s.teacher_local_time : s.student_local_time;
                const theirTime = mode === 'teacher' ? s.student_local_time : s.teacher_local_time;
                const duration = s.duration_minutes || 30;
                return (
                  <Card key={`${s.id}-${idx}`} className="border-border">
                    <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{counterpartName}</span>
                          {s.movedIn && (
                            <Badge variant="outline" className="text-[10px]">Rescheduled</Badge>
                          )}
                          {s.effectivePeriod?.period_type === 'temporary' && (
                            <Badge variant="outline" className="text-[10px]">Temporary timing</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime12h(myTime?.slice(0, 5))} – {formatTime12h(addMinutes(myTime?.slice(0, 5), duration))}{' '}
                          {getTimezoneAbbr(selfTz)} · {duration} min
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p className="uppercase tracking-wide text-[10px]">
                          {mode === 'teacher' ? 'Student time' : 'Teacher time'}
                        </p>
                        <p className="font-medium text-foreground">
                          {formatTime12h(theirTime?.slice(0, 5))} {getTimezoneAbbr(counterpartTz)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
