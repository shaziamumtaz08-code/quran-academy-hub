import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, Clock, ChevronRight } from 'lucide-react';
import { resolveSchedulesForDate, localIsoDate } from '@/lib/schedulePeriods';
import { formatTime12h, getTimezoneAbbr } from '@/lib/timezones';
import { DEFAULT_ACADEMY_TZ } from '@/hooks/useAcademyTimezone';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface Row {
  id: string;
  title: string;
  subtitle?: string;
  time: string;
  duration: number;
  badge?: string;
}

/** Compact "today's classes" strip for the teacher dashboard (1:1 + Group). */
export function TeacherTodaySchedule() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const modelType = (activeDivision?.model_type as string) || null;
  const isGroup = modelType === 'group' || modelType === 'recorded';

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);
  const todayIso = localIsoDate(today);
  const todayName = DAY_NAMES[today.getDay()];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['teacher-today-schedule', user?.id, activeDivision?.id, todayIso],
    enabled: !!user?.id,
    queryFn: async (): Promise<Row[]> => {
      if (isGroup) {
        const { data: staffRows, error } = await (supabase as any)
          .from('course_class_staff')
          .select('class_id, course_classes!inner(id, name, schedule_days, schedule_time, session_duration, courses!inner(name))')
          .eq('user_id', user!.id);
        if (error) throw error;
        return (staffRows || [])
          .filter((r: any) => {
            const days = Array.isArray(r.course_classes?.schedule_days) ? r.course_classes.schedule_days : [];
            return days.map((d: string) => String(d).toLowerCase()).includes(todayName);
          })
          .map((r: any) => ({
            id: r.class_id,
            title: r.course_classes?.name || 'Class',
            subtitle: r.course_classes?.courses?.name,
            time: String(r.course_classes?.schedule_time || '00:00').slice(0, 5),
            duration: r.course_classes?.session_duration || 0,
          }))
          .sort((a, b) => a.time.localeCompare(b.time));
      }

      // 1:1 — resolve active assignment schedules for today
      let q = supabase
        .from('student_teacher_assignments')
        .select('id, student_id, teacher_id')
        .eq('teacher_id', user!.id)
        .eq('status', 'active') as any;
      if (activeDivision?.id) q = q.eq('division_id', activeDivision.id);
      const { data: assignments, error } = await q;
      if (error) throw error;
      if (!assignments?.length) return [];

      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: schedules } = await (supabase as any)
        .from('schedules')
        .select('*')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);
      const scheduleIds = (schedules || []).map((s: any) => s.id);
      if (!scheduleIds.length) return [];

      const [{ data: periods }, { data: overrides }] = await Promise.all([
        (supabase as any).from('schedule_periods').select('*').in('schedule_id', scheduleIds),
        (supabase as any).from('schedule_overrides').select('*').in('schedule_id', scheduleIds),
      ]);

      const studentIds = [...new Set(assignments.map((a: any) => a.student_id).filter(Boolean))] as string[];
      const { data: students } = studentIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : { data: [] };
      const names = Object.fromEntries((students || []).map((p: any) => [p.id, p.full_name]));
      const assignMap = Object.fromEntries(assignments.map((a: any) => [a.id, a]));

      const resolved = resolveSchedulesForDate((schedules || []) as any[], (periods || []) as any[], today);
      const items: Row[] = resolved
        .filter((s: any) => !(overrides || []).some((o: any) => o.schedule_id === s.id && o.original_date === todayIso))
        .map((s: any) => ({
          id: s.id,
          title: names[assignMap[s.assignment_id]?.student_id] || 'Student',
          time: (s.teacher_local_time || '00:00').slice(0, 5),
          duration: s.duration_minutes || 30,
          badge: s.effectivePeriod?.period_type === 'temporary' ? 'Temp' : undefined,
        }));

      // classes rescheduled INTO today
      (overrides || [])
        .filter((o: any) => o.new_date === todayIso)
        .forEach((o: any) => {
          const base = (schedules || []).find((s: any) => s.id === o.schedule_id);
          if (!base) return;
          items.push({
            id: `${base.id}-moved`,
            title: names[assignMap[base.assignment_id]?.student_id] || 'Student',
            time: (o.new_start_time || base.teacher_local_time || '00:00').slice(0, 5),
            duration: base.duration_minutes || 30,
            badge: 'Moved',
          });
        });

      return items.sort((a, b) => a.time.localeCompare(b.time));
    },
  });

  const tzAbbr = getTimezoneAbbr(DEFAULT_ACADEMY_TZ);

  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-extrabold text-foreground flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-accent" />
            Today's Classes
            <span className="text-[11px] font-medium text-muted-foreground">
              · {today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
          </p>
          <Link
            to="/my-schedule"
            className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
          >
            Full schedule <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No classes scheduled for today.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground truncate">{r.title}</span>
                  {r.subtitle && (
                    <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">{r.subtitle}</span>
                  )}
                  {r.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-accent border border-accent/30 rounded px-1 py-px">
                      {r.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatTime12h(r.time)} {tzAbbr}{r.duration ? ` · ${r.duration}m` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
