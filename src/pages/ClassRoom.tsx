import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, MonitorPlay, BookOpen } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';

interface RosterRow {
  student_id: string;
  student_name: string;
  subject_name: string;
}

export default function ClassRoom() {
  const { user, activeRole } = useAuth();
  const { activeDivision } = useDivision();
  const [search, setSearch] = useState('');

  const isAdmin = !!activeRole && (activeRole === 'super_admin' || activeRole.startsWith('admin'));

  const { data: roster = [], isLoading } = useQuery({
    queryKey: ['classroom-roster', user?.id, activeDivision?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async (): Promise<RosterRow[]> => {
      let query = supabase
        .from('student_teacher_assignments')
        .select('id, student_id, subject_id, status, created_at')
        .eq('status', 'active') as any;

      if (!isAdmin) query = query.eq('teacher_id', user!.id);
      if (activeDivision?.id) query = query.eq('division_id', activeDivision.id);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let rows = (data || []) as any[];

      // Group divisions have no 1:1 assignments — fall back to class rosters.
      if (rows.length === 0 && (activeDivision?.model_type as string) === 'group') {
        let staffQ = (supabase as any).from('course_class_staff').select('class_id');
        if (!isAdmin) staffQ = staffQ.eq('user_id', user!.id);
        const { data: staffRows } = await staffQ;
        const classIds = [...new Set(((staffRows || []) as any[]).map((c) => c.class_id).filter(Boolean))];
        if (classIds.length) {
          const { data: rosterRows } = await (supabase as any)
            .from('course_class_students')
            .select('student_id, status')
            .in('class_id', classIds)
            .eq('status', 'active');
          rows = ((rosterRows || []) as any[]).map((r) => ({ student_id: r.student_id, subject_id: null }));
        }
      }
      const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
      const subjectIds = [...new Set(rows.map((r) => r.subject_id).filter(Boolean))];

      const [studentsRes, subjectsRes] = await Promise.all([
        studentIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', studentIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        subjectIds.length
          ? supabase.from('subjects').select('id, name').in('id', subjectIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const studentMap = Object.fromEntries(((studentsRes as any).data || []).map((s: any) => [s.id, s.full_name]));
      const subjectMap = Object.fromEntries(((subjectsRes as any).data || []).map((s: any) => [s.id, s.name]));

      const seen = new Map<string, RosterRow>();
      for (const r of rows) {
        if (!r.student_id) continue;
        const key = `${r.student_id}`;
        const subject = r.subject_id ? subjectMap[r.subject_id] || '—' : '—';
        const existing = seen.get(key);
        if (existing) {
          if (subject !== '—' && !existing.subject_name.includes(subject)) {
            existing.subject_name = existing.subject_name === '—' ? subject : `${existing.subject_name}, ${subject}`;
          }
        } else {
          seen.set(key, {
            student_id: r.student_id,
            student_name: studentMap[r.student_id] || 'Unknown student',
            subject_name: subject,
          });
        }
      }
      return [...seen.values()].sort((a, b) => a.student_name.localeCompare(b.student_name));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((r) => r.student_name.toLowerCase().includes(q) || r.subject_name.toLowerCase().includes(q));
  }, [roster, search]);

  return (
    <PageShell
      title="Class Room"
      description="Open the live Virtual Class Room or review a student's syllabus"
    >
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or subject…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border py-16 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No active students</p>
            <p className="mt-1 text-xs">Students appear here once an active assignment exists.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <div key={r.student_id} className="rounded-xl border border-border bg-card p-4">
                <p className="truncate text-base font-semibold text-lms-navy">{r.student_name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.subject_name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/vcr/${r.student_id}`} className="vcr-btn-gold inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold">
                    <MonitorPlay className="h-4 w-4" />
                    Open VCR
                  </Link>
                  <Link
                    to={`/syllabus/${r.student_id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <BookOpen className="h-4 w-4" />
                    View Syllabus
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
