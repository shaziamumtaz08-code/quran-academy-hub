import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SubjectProgressTimelineCard,
  SubjectTimeline,
  TimelinePoint,
} from '@/components/reports/SubjectProgressTimelineCard';
import type { StoredCriteriaEntry } from '@/types/reportCard';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function buildMonths(count: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

export default function ProgressTimeline() {
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const mode = (searchParams.get('mode') || 'staff') as 'student' | 'staff';
  const range = Number(searchParams.get('range') || 12) === 6 ? 6 : 12;
  const studentId = routeStudentId || searchParams.get('student') || user?.id || '';

  const months = React.useMemo(() => buildMonths(range), [range]);
  const fromDate = React.useMemo(() => `${months[0]}-01`, [months]);

  const { data, isLoading } = useQuery({
    queryKey: ['progress-timeline', studentId, range],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id, exam_date, percentage, criteria_values_json, public_remarks, examiner_remarks, remarks_status,
          student:profiles!exams_student_id_fkey(id, full_name),
          template:exam_templates!exams_template_id_fkey(id, name, tenure, subject:subjects(id, name))
        `)
        .eq('student_id', studentId)
        .gte('exam_date', fromDate)
        .is('deleted_at', null)
        .order('exam_date', { ascending: true });
      if (error) throw error;
      return (data || []).filter((r: any) => r.template?.tenure === 'monthly');
    },
  });

  const studentName = (data?.[0] as any)?.student?.full_name ?? '';

  const timelines: SubjectTimeline[] = React.useMemo(() => {
    if (!data) return [];
    const bySubject = new Map<string, { name: string; rows: any[] }>();
    for (const row of data as any[]) {
      const subj = row.template?.subject;
      const id = subj?.id || row.template?.id || 'unknown';
      const name = subj?.name || row.template?.name || 'Subject';
      if (!bySubject.has(id)) bySubject.set(id, { name, rows: [] });
      bySubject.get(id)!.rows.push(row);
    }

    return Array.from(bySubject.entries()).map(([subjectId, { name, rows }]) => {
      const criteriaNames = Array.from(
        new Set(
          rows.flatMap((r) =>
            ((r.criteria_values_json || []) as StoredCriteriaEntry[]).map((c) => c.criteria_name),
          ),
        ),
      ).slice(0, 4);

      const points: TimelinePoint[] = months.map((key) => {
        const row = rows.find((r) => monthKey(new Date(r.exam_date)) === key);
        const values: Record<string, number> = {};
        if (row) {
          for (const c of (row.criteria_values_json || []) as StoredCriteriaEntry[]) {
            if (criteriaNames.includes(c.criteria_name) && c.max_marks > 0) {
              values[c.criteria_name] = Math.round((c.obtained_marks / c.max_marks) * 100);
            }
          }
        }
        const published = !row || row.remarks_status !== 'needs_review';
        return {
          monthKey: key,
          monthLabel: monthLabel(key),
          values,
          overall: row ? Number(row.percentage ?? 0) : 0,
          publicRemark: row && (mode === 'staff' || published) ? row.public_remarks ?? null : null,
          examinerRemark: row?.examiner_remarks ?? null,
        };
      });

      return { subjectId, subjectName: name, criteriaNames, points };
    });
  }, [data, months, mode]);

  const setRange = (r: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('range', String(r));
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Progress Timeline</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {studentName || 'Student progress'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly report cards across the last {range} months
            {mode === 'staff' ? ' — staff view with internal notes' : ''}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
          <CalendarRange className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          {[6, 12].map((r) => (
            <Button
              key={r}
              size="sm"
              variant="ghost"
              onClick={() => setRange(r)}
              className={cn(
                'h-8 rounded-full px-4 text-xs font-medium',
                range === r && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >
              {r} months
            </Button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : timelines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-base font-medium">No monthly report cards in this period</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try the 12-month range, or publish a monthly report card first.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {timelines.map((t, i) => (
            <SubjectProgressTimelineCard key={t.subjectId} timeline={t} accentIndex={i} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}
