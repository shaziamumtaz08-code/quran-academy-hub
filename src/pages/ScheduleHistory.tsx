import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { History, CalendarClock, RotateCcw } from 'lucide-react';
import { DAYS_LABELS } from '@/lib/scheduleWeekdays';

interface HistoryRow {
  id: string;
  created_at: string;
  actor: string;
  assignment_id: string | null;
  day: string;
  period_type: string;
  effective_from: string | null;
  effective_to: string | null;
  is_backdated: boolean;
  batch_id: string | null;
  reason: string;
  oldTime: string | null;
  newTime: string | null;
  oldDuration: number | null;
  newDuration: number | null;
}

const shortTime = (t?: string | null) => {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${suffix}`;
};

const shortDate = (d?: string | null) =>
  d ? format(new Date(`${d}T12:00:00`), 'dd MMM yyyy') : '—';

export default function ScheduleHistory() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-period-history'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('system_logs')
        .select('id, created_at, user_full_name, old_values, new_values, details')
        .eq('action', 'schedule_period_applied')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows: HistoryRow[] = (logs || []).map((l: any) => {
        const d = (l.details || {}) as any;
        const oldV = (l.old_values || {}) as any;
        const newV = (l.new_values || {}) as any;
        return {
          id: l.id,
          created_at: l.created_at,
          actor: l.user_full_name || 'Unknown',
          assignment_id: d.assignment_id || null,
          day: d.day_of_week || '',
          period_type: d.period_type || 'permanent',
          effective_from: d.effective_from || null,
          effective_to: d.effective_to || null,
          is_backdated: Boolean(d.is_backdated),
          batch_id: d.batch_id || null,
          reason: d.change_reason || '',
          oldTime: oldV.student_local_time || null,
          newTime: newV.student_local_time || null,
          oldDuration: oldV.duration_minutes ?? null,
          newDuration: newV.duration_minutes ?? null,
        };
      });

      const ids = Array.from(new Set(rows.map(r => r.assignment_id).filter(Boolean))) as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select(`id,
            teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
            student:profiles!student_teacher_assignments_student_id_fkey(full_name)`)
          .in('id', ids);
        (assignments || []).forEach((a: any) => {
          names.set(a.id, `${a.student?.full_name || 'Student'} → ${a.teacher?.full_name || 'Teacher'}`);
        });
      }
      return { rows, names };
    },
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const map = new Map<string, { label: string; rows: HistoryRow[] }>();
    data.rows.forEach(r => {
      const key = r.assignment_id || 'unknown';
      const label = data.names.get(key) || 'Unlinked class';
      if (q && !label.toLowerCase().includes(q) && !r.reason.toLowerCase().includes(q)) return;
      if (!map.has(key)) map.set(key, { label, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data, search]);

  return (
    <div className="p-3 md:p-5 max-w-[1100px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-extrabold text-foreground">Schedule change history</h1>
            <p className="text-xs text-muted-foreground">Every saved timing change, grouped by class.</p>
          </div>
        </div>
        <Input
          className="h-9 w-full sm:w-64"
          placeholder="Search student, teacher or reason"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <Skeleton className="h-40 rounded-2xl" />}

      {!isLoading && groups.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No schedule changes recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Changes saved from the Schedules page will appear here with their old and new timing.
          </p>
        </div>
      )}

      {groups.map(group => (
        <div key={group.label} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/40 flex items-center justify-between">
            <p className="text-sm font-extrabold text-foreground">{group.label}</p>
            <span className="text-[11px] text-muted-foreground">{group.rows.length} change{group.rows.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-border">
            {group.rows.map(r => (
              <div key={r.id} className="px-4 py-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">{DAYS_LABELS[r.day] || r.day || 'Class day'}</span>
                  <span className="text-muted-foreground line-through">{shortTime(r.oldTime)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-bold text-foreground">{shortTime(r.newTime)}</span>
                  {r.newDuration !== null && (
                    <span className="text-xs text-muted-foreground">
                      ({r.oldDuration !== null && r.oldDuration !== r.newDuration ? `${r.oldDuration} → ` : ''}{r.newDuration} min)
                    </span>
                  )}
                  {r.is_backdated && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gold border border-gold/30 bg-gold/10 rounded-md px-1.5 py-0.5">
                      <RotateCcw className="h-3 w-3" /> Back-dated
                    </span>
                  )}
                  {r.period_type === 'temporary' && (
                    <span className="text-[11px] font-bold text-sky border border-sky/30 bg-sky/10 rounded-md px-1.5 py-0.5">
                      Temporary
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Applies from {shortDate(r.effective_from)}{r.effective_to ? ` to ${shortDate(r.effective_to)}` : ' onwards'}
                  {r.batch_id ? ' · saved with other days' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.reason ? `“${r.reason}” — ` : ''}{r.actor} · {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
