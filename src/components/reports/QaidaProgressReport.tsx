import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StickyScrollTable } from '@/components/ui/sticky-scroll-table';
import { Search, Download } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import { useQaidaProgressForStudents } from '@/hooks/useQaidaProgress';

export default function QaidaProgressReport() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [search, setSearch] = useState('');

  const { data: students } = useQuery({
    queryKey: ['qaida-report-students', divisionId],
    queryFn: async () => {
      let q = supabase
        .from('student_teacher_assignments')
        .select('student_id, subject:subject_id(name), student:profiles!student_teacher_assignments_student_id_fkey(full_name)')
        .eq('status', 'active');
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      const seen = new Map<string, { id: string; name: string }>();
      (data || []).forEach((a: any) => {
        const subject = (a.subject?.name || '').toLowerCase();
        if (!subject.includes('qaida') && !subject.includes('noorani') && !subject.includes('قاعدہ')) return;
        if (!seen.has(a.student_id)) {
          seen.set(a.student_id, { id: a.student_id, name: a.student?.full_name || 'Unknown' });
        }
      });
      return [...seen.values()];
    },
  });

  const studentIds = useMemo(() => (students || []).map(s => s.id), [students]);
  const { progressByStudent, baabs } = useQaidaProgressForStudents(studentIds);

  const rows = useMemo(() => {
    return (students || [])
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      .map(s => ({ ...s, progress: progressByStudent.get(s.id) }))
      .sort((a, b) => (b.progress?.overallPercent || 0) - (a.progress?.overallPercent || 0));
  }, [students, search, progressByStudent]);

  const exportCsv = () => {
    const header = ['Student', 'Current baab', 'Current page', 'Overall %', 'Last lesson', ...baabs.map(b => `B${b.baab_number} %`)];
    const csv = [header, ...rows.map(r => [
      r.name,
      r.progress?.currentBaab ? `${r.progress.currentBaab.baab_number} — ${r.progress.currentBaab.name_english}` : '—',
      r.progress?.currentPage ?? '—',
      `${r.progress?.overallPercent ?? 0}%`,
      r.progress?.lastDate || '—',
      ...baabs.map(b => `${r.progress?.baabs.find(x => x.id === b.id)?.percent ?? 0}%`),
    ])].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'qaida_progress.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <StickyScrollTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">Student</th>
                  <th className="p-3 text-left font-medium">Current baab</th>
                  <th className="p-3 text-center font-medium">Page</th>
                  <th className="p-3 text-center font-medium">Overall</th>
                  <th className="p-3 text-center font-medium">Last lesson</th>
                  <th className="p-3 text-left font-medium">Baabs 1–16</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-xs">
                      {r.progress?.currentBaab
                        ? `B${r.progress.currentBaab.baab_number} · ${r.progress.currentBaab.name_english}`
                        : '—'}
                    </td>
                    <td className="p-3 text-center">{r.progress?.currentPage ?? '—'}</td>
                    <td className="p-3 text-center">
                      <Badge variant={(r.progress?.overallPercent || 0) >= 60 ? 'default' : 'secondary'}>
                        {r.progress?.overallPercent ?? 0}%
                      </Badge>
                    </td>
                    <td className="p-3 text-center text-xs text-muted-foreground">{r.progress?.lastDate || '—'}</td>
                    <td className="p-3">
                      <div className="flex gap-0.5">
                        {(r.progress?.baabs || baabs).map((b: any) => (
                          <span
                            key={b.id}
                            title={`Baab ${b.baab_number}: ${b.name_english} — ${b.percent ?? 0}%`}
                            className="h-6 w-2.5 overflow-hidden rounded-sm bg-muted"
                          >
                            <span
                              className="block w-full bg-primary"
                              style={{ height: `${b.percent ?? 0}%`, marginTop: `${100 - (b.percent ?? 0)}%` }}
                            />
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No Qaida students found</td></tr>
                )}
              </tbody>
            </table>
          </StickyScrollTable>
        </CardContent>
      </Card>
    </div>
  );
}
