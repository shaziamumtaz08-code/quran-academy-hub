import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, Video, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { useAcademyTimezone, zonedClockLabel, zonedDayName, zonedTimeToEpoch } from '@/hooks/useAcademyTimezone';
import { cn } from '@/lib/utils';
import { useInAppZoomJoin } from '@/hooks/useInAppZoomJoin';
import type { SchedulePeriod } from '@/lib/schedulePeriods';

interface ClassRow {
  key: string;
  divisionId: string | null;
  teacherId: string;
  studentId: string | null;
  teacherName: string;
  studentName: string;
  className: string;
  assignmentId: string | null;
  scheduleId: string | null;
  liveSessionId: string | null;
  startMs: number;
  durationMin: number;
  isLive: boolean;
}

const JOIN_LEAD_MS = 5 * 60 * 1000;
const JOIN_TAIL_MS = 15 * 60 * 1000;

interface Props {
  divisionNames: Record<string, string>;
}

export function LiveClassesPanel({ divisionNames }: Props) {
  const tz = useAcademyTimezone();
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningKey, setJoiningKey] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const { join: joinClass, dialog: zoomDialog } = useInAppZoomJoin(0);


  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const dayName = zonedDayName(tz);
      const dayStart = new Date(zonedTimeToEpoch(tz, '00:00'));
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const [schedRes, liveRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, division_id, teacher_local_time, duration_minutes, assignment_id, student_teacher_assignments!inner(id, teacher_id, student_id, status, duration_minutes, division_id)')
          .eq('day_of_week', dayName)
          .eq('is_active', true)
          .eq('student_teacher_assignments.status', 'active'),
        supabase
          .from('live_sessions')
          .select('id, teacher_id, student_id, assignment_id, schedule_id, scheduled_start, status')
          .gte('scheduled_start', dayStart.toISOString())
          .lte('scheduled_start', dayEnd.toISOString())
          .in('status', ['scheduled', 'live']),
      ]);

      // Base `schedules` rows go stale after a reschedule — the *current* time
      // for each weekly slot lives in schedule_periods. Overlay them so the
      // queue shows the times admins see on the Schedules page.
      const schedIds = (schedRes.data || []).map((s: any) => s.id).filter(Boolean);
      let periods: SchedulePeriod[] = [];
      if (schedIds.length) {
        const { data: perRows } = await supabase
          .from('schedule_periods')
          .select('id, schedule_id, assignment_id, day_of_week, student_local_time, teacher_local_time, duration_minutes, period_type, effective_from, effective_to, created_at')
          .in('schedule_id', schedIds);
        periods = (perRows || []) as unknown as SchedulePeriod[];
      }

      // One-off reschedules: a slot moved off today must disappear from the queue.
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(dayStart));
      const movedAway = new Set<string>();
      const movedIn = new Map<string, string>();
      if (schedIds.length) {
        const { data: ovRows } = await supabase
          .from('schedule_overrides')
          .select('id, schedule_id, original_date, new_date, new_start_time')
          .in('schedule_id', schedIds)
          .or(`original_date.eq.${todayKey},new_date.eq.${todayKey}`);
        (ovRows || []).forEach((o: any) => {
          if (o.original_date === todayKey && o.new_date !== todayKey) movedAway.add(o.schedule_id);
          if (o.new_date === todayKey && o.new_start_time) movedIn.set(o.schedule_id, o.new_start_time);
        });
      }

      // Effective (period-aware) time for each of today's slots. Resolved against
      // the academy timezone's weekday/date, not the browser's.
      const periodsBySchedule = new Map<string, any[]>();
      periods.forEach((p: any) => {
        if (String(p.day_of_week || '').toLowerCase() !== dayName) return;
        const list = periodsBySchedule.get(p.schedule_id) || [];
        list.push(p);
        periodsBySchedule.set(p.schedule_id, list);
      });

      const effective = new Map<string, { time: string; duration: number | null; dropped: boolean }>();
      (schedRes.data || []).forEach((s: any) => {
        const forSlot = periodsBySchedule.get(s.id) || [];
        const active = forSlot
          .filter((p) => p.effective_from <= todayKey && (!p.effective_to || p.effective_to >= todayKey))
          .sort((a, b) => {
            if (a.period_type !== b.period_type) return a.period_type === 'temporary' ? -1 : 1;
            return (
              String(b.effective_from).localeCompare(String(a.effective_from)) ||
              String(b.created_at).localeCompare(String(a.created_at))
            );
          })[0];

        // A permanent period that ended with nothing replacing it means the
        // weekly class was dismantled — it should not show up today.
        const lastPermanent = forSlot
          .filter((p) => p.period_type === 'permanent' && p.effective_from <= todayKey)
          .sort((a, b) =>
            String(b.effective_from).localeCompare(String(a.effective_from)) ||
            String(b.created_at).localeCompare(String(a.created_at)),
          )[0];
        const discontinued = !active && Boolean(lastPermanent?.effective_to && lastPermanent.effective_to < todayKey);

        effective.set(s.id, {
          time: movedIn.get(s.id) || active?.teacher_local_time || s.teacher_local_time,
          duration: active?.duration_minutes ?? s.duration_minutes ?? null,
          dropped: discontinued || (movedAway.has(s.id) && !movedIn.has(s.id)),
        });
      });

      const liveByAssignment = new Map<string, any>();
      (liveRes.data || []).forEach((s: any) => {
        if (s.assignment_id) liveByAssignment.set(s.assignment_id, s);
      });

      const ids = new Set<string>();
      (schedRes.data || []).forEach((s: any) => {
        const a = s.student_teacher_assignments;
        if (a?.teacher_id) ids.add(a.teacher_id);
        if (a?.student_id) ids.add(a.student_id);
      });

      const nameMap = new Map<string, string>();
      if (ids.size) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(ids));
        (profs || []).forEach((p: any) => nameMap.set(p.id, p.full_name || '—'));
      }

      const built: ClassRow[] = (schedRes.data || []).filter((s: any) => !effective.get(s.id)?.dropped).map((s: any) => {
        const a = s.student_teacher_assignments;
        const ls = a?.id ? liveByAssignment.get(a.id) : null;
        const eff = effective.get(s.id);
        return {
          key: `sc:${s.id}`,
          divisionId: s.division_id || a?.division_id || null,
          teacherId: a.teacher_id,
          studentId: a.student_id,
          teacherName: nameMap.get(a.teacher_id) || '—',
          studentName: nameMap.get(a.student_id) || '—',
          className: `${nameMap.get(a.student_id) || '—'} · ${nameMap.get(a.teacher_id) || '—'}`,
          assignmentId: a.id,
          scheduleId: s.id,
          liveSessionId: ls?.id || null,
          startMs: zonedTimeToEpoch(tz, eff?.time || s.teacher_local_time),
          durationMin: eff?.duration || s.duration_minutes || a?.duration_minutes || 30,
          isLive: ls?.status === 'live',
        };
      });

      if (!cancelled) {
        setRows(built.sort((x, y) => x.startMs - y.startMs));
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tz]);

  const decorated = useMemo(
    () =>
      rows.map((r) => {
        const inWindow = now >= r.startMs - JOIN_LEAD_MS && now <= r.startMs + r.durationMin * 60_000 + JOIN_TAIL_MS;
        return { ...r, live: r.isLive, joinAvailable: inWindow };
      }),
    [rows, now],
  );

  const handleJoin = async (row: ClassRow) => {
    setJoiningKey(row.key);
    try {
      await joinClass(
        {
          teacherId: row.teacherId,
          studentId: row.studentId,
          assignmentId: row.assignmentId,
          scheduleId: row.scheduleId,
          scheduledStart: new Date(row.startMs).toISOString(),
          liveSessionId: row.liveSessionId,
        },
        row.className,
      );
    } finally {
      setJoiningKey(null);
    }
  };

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Radio className="h-4 w-4 text-accent" /> Live &amp; Upcoming Classes
        </h2>
        <span className="text-xs text-muted-foreground">{decorated.length} today</span>
      </header>

      {loading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : decorated.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No classes scheduled today.</p>
      ) : (
        <>
          <ul
            className={`divide-y divide-border overflow-y-auto ${expanded ? 'max-h-[70vh]' : 'max-h-[480px]'}`}
          >
            {decorated.map((row) => (
              <li
                key={row.key}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-5 py-3 transition-colors',
                  row.live
                    ? 'bg-emerald-500/[0.06] border-l-4 border-l-emerald-500 dark:bg-emerald-500/[0.09]'
                    : 'border-l-4 border-l-transparent hover:bg-muted/30'
                )}
              >
                <Badge
                  className={cn(
                    'border-0',
                    row.live
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-pulse'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {row.live ? 'Live' : 'Upcoming'}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  {divisionNames[row.divisionId || ''] || 'Unassigned'}
                </Badge>
                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.studentName}</p>
                  <p className="truncate text-xs text-muted-foreground">with {row.teacherName}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {zonedClockLabel(tz, new Date(row.startMs))}
                </span>
                <Button
                  size="sm"
                  disabled={!row.joinAvailable || joiningKey === row.key}
                  onClick={() => handleJoin(row)}
                  className={cn(
                    'ml-auto',
                    row.joinAvailable && 'bg-emerald-600 hover:bg-emerald-700 text-primary-foreground'
                  )}
                >
                  {joiningKey === row.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Video className="mr-1 h-3.5 w-3.5" />
                  )}
                  Join
                </Button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {expanded ? (
              <>Collapse <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>Expand all ({decorated.length}) <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        </>
      )}
      {zoomDialog}
    </section>
  );
}

