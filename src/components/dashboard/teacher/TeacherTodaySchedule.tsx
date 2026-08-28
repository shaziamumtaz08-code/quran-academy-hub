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

  // Cycle accent tokens per class chip so the row doesn't look monotone
  const ACCENTS = [
    { bar: 'bg-teal', text: 'text-teal' },
    { bar: 'bg-sky', text: 'text-sky' },
    { bar: 'bg-gold', text: 'text-gold' },
    { bar: 'bg-accent', text: 'text-accent' },
  ];

  return (
    <Card className="rounded-2xl border-border shadow-card">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-2.5">
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
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-44 shrink-0 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-secondary/50 rounded-xl py-4 px-3 text-center">
            <CalendarClock className="h-5 w-5 text-muted-foreground/60 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No classes scheduled for today — enjoy the breathing room.</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rows.map((r, idx) => {
              const accent = ACCENTS[idx % ACCENTS.length];
              return (
                <div
                  key={r.id}
                  className="relative shrink-0 snap-start w-44 rounded-xl bg-secondary/50 pl-3 pr-2.5 py-2 overflow-hidden"
                >
                  {/* colored left-edge accent bar */}
                  <span className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${accent.bar}`} />
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{r.title}</p>
                    {r.badge && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-accent bg-accent/10 border border-accent/30 rounded-full px-1.5 py-px">
                        {r.badge}
                      </span>
                    )}
                  </div>
                  {r.subtitle && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                  )}
                  <p className={`text-[11px] font-medium mt-1.5 flex items-center gap-1 ${accent.text}`}>
                    <Clock className="h-3 w-3" />
                    {formatTime12h(r.time)} <span className="text-muted-foreground font-normal">{tzAbbr}</span>
                    {r.duration ? <span className="text-muted-foreground font-normal">· {r.duration}m</span> : null}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
