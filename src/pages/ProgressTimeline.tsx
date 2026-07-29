import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConditionalDashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { PageShell } from '@/components/layout/PageShell';
import { ArrowLeft, CalendarRange, FileText, Search, TrendingUp, Users } from 'lucide-react';
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

interface TimelineStudentOption {
  id: string;
  name: string;
  reportCount: number;
  latestDate: string | null;
  averagePercentage: number | null;
}

function formatDate(value: string | null) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProgressTimeline() {
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeRole, user } = useAuth();
  const { activeKidId } = useKidContext();
  const [studentSearch, setStudentSearch] = React.useState('');

  const isStudentOrParent = activeRole === 'student' || activeRole === 'parent';
  const mode = (searchParams.get('mode') || (isStudentOrParent ? 'student' : 'staff')) as 'student' | 'staff';
  const range = Number(searchParams.get('range') || 12) === 6 ? 6 : 12;
  const studentId = routeStudentId || searchParams.get('student') || (activeRole === 'student' ? user?.id : '') || (activeRole === 'parent' ? activeKidId || '' : '');

  const months = React.useMemo(() => buildMonths(range), [range]);
  const fromDate = React.useMemo(() => `${months[0]}-01`, [months]);

  const { data: studentOptions = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['progress-timeline-students', user?.id, activeRole, activeKidId],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id, student_id, exam_date, percentage,
          student:profiles!exams_student_id_fkey(id, full_name),
          template:exam_templates!inner(id, tenure)
        `)
        .eq('template.tenure', 'monthly')
        .is('deleted_at', null)
        .order('exam_date', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const byStudent = new Map<string, { name: string; count: number; latest: string | null; total: number; scored: number }>();
      for (const row of (data || []) as any[]) {
        if (!row.student_id) continue;
        const current = byStudent.get(row.student_id) || {
          name: row.student?.full_name || 'Student',
          count: 0,
          latest: null,
          total: 0,
          scored: 0,
        };
        current.count += 1;
        if (!current.latest || new Date(row.exam_date) > new Date(current.latest)) current.latest = row.exam_date;
        if (row.percentage !== null && row.percentage !== undefined) {
          current.total += Number(row.percentage);
          current.scored += 1;
        }
        byStudent.set(row.student_id, current);
      }

      return Array.from(byStudent.entries())
        .map(([id, item]) => ({
          id,
          name: item.name,
          reportCount: item.count,
          latestDate: item.latest,
          averagePercentage: item.scored ? Math.round(item.total / item.scored) : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) as TimelineStudentOption[];
    },
  });

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

  const selectedStudent = studentOptions.find((student) => student.id === studentId);
  const studentName = selectedStudent?.name || (data?.[0] as any)?.student?.full_name || '';

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

  const selectStudent = (id: string) => {
    navigate(`/progress-timeline?student=${id}&range=${range}&mode=${mode}`);
  };

  const filteredStudents = studentOptions.filter((student) =>
    student.name.toLowerCase().includes(studentSearch.trim().toLowerCase()),
  );

  const actions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button variant="outline" size="sm" asChild>
        <Link to="/student-reports">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Student Reports
        </Link>
      </Button>
      <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1">
        <CalendarRange className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        {[6, 12].map((r) => (
          <Button
            key={r}
            size="sm"
            variant="ghost"
            onClick={() => setRange(r)}
            className={cn(
              'h-8 px-3 text-xs font-medium',
              range === r && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            )}
          >
            {r} months
          </Button>
        ))}
      </div>
    </div>
  );

  const studentSelector = studentOptions.length > 0 ? (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Student report timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Search student by name"
            className="pl-9"
          />
        </div>
        <Select value={studentId || undefined} onValueChange={selectStudent}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  ) : null;

  const emptyStudentSelection = (
    <Card className="border-dashed bg-card/70">
      <CardContent className="py-10 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-base font-medium">No monthly report cards found</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Generate or publish monthly student report cards first; they will appear here as progress timelines.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/student-reports">Open Student Reports</Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ConditionalDashboardLayout>
      <PageShell
        title={studentName ? `${studentName} — Progress Timeline` : 'Progress Timeline'}
        description={`Monthly report card trends across the last ${range} months${mode === 'staff' ? ', including staff notes.' : '.'}`}
        actions={actions}
      >
        <div className="space-y-6">
          {studentsLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : studentSelector}

          {!studentsLoading && studentOptions.length === 0 ? (
            emptyStudentSelection
          ) : !studentId ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.slice(0, 18).map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => selectStudent(student.id)}
                  className="rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{student.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Latest: {formatDate(student.latestDate)}</p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{student.reportCount} monthly reports</span>
                    {student.averagePercentage !== null ? <span>• Avg {student.averagePercentage}%</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <div className="space-y-8">
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : timelines.length === 0 ? (
            <Card className="border-dashed bg-card/70">
              <CardContent className="py-10 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-base font-medium">No monthly report cards in this period</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try the 12-month range, or choose another student with monthly reports.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {timelines.map((t, i) => (
                <SubjectProgressTimelineCard key={t.subjectId} timeline={t} accentIndex={i} mode={mode} />
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </ConditionalDashboardLayout>
  );
}
