import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO, endOfMonth } from 'date-fns';

interface Props {
  onOpenMonth?: (month: string) => void;
}

interface AuditRow {
  payoutId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  status: string;
  netSalary: number;
  missing: { id: string; student: string; status: string }[];
  extra: { id: string; student: string }[];
}

/**
 * Cross-month reconciliation: compares every saved (non-archived, non-void) salary sheet
 * against the assignments that were genuinely active in that month, using the
 * month-granular end-date rule. Any back-dated change (assignment end/start, fee plan
 * revision, status change) surfaces here as a stale sheet that must be revised.
 */
export function SalarySheetAuditPanel({ onOpenMonth }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['salary-sheet-audit'],
    queryFn: async () => {
      const [payoutsRes, assignRes] = await Promise.all([
        supabase
          .from('salary_payouts')
          .select('id, teacher_id, salary_month, status, net_salary, calculation_json')
          .eq('is_archived', false)
          .is('voided_at', null),
        supabase
          .from('student_teacher_assignments')
          .select('id, teacher_id, student_id, status, salary_linked, effective_from_date, effective_to_date, status_effective_date, start_date, profiles!student_teacher_assignments_student_id_fkey(full_name)'),
      ]);

      const teacherIds = Array.from(new Set((payoutsRes.data || []).map((p: any) => p.teacher_id)));
      const { data: profiles } = teacherIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
        : { data: [] as any[] };

      return {
        payouts: payoutsRes.data || [],
        assignments: assignRes.data || [],
        profiles: profiles || [],
      };
    },
  });

  const rows: AuditRow[] = useMemo(() => {
    if (!data) return [];
    const nameById = new Map<string, string>(data.profiles.map((p: any) => [p.id, p.full_name]));
    const out: AuditRow[] = [];

    for (const payout of data.payouts as any[]) {
      const monthStart = `${payout.salary_month}-01`;
      const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');

      const savedList: any[] = payout.calculation_json?.students || [];
      const savedIds = new Set(savedList.map((s: any) => s.assignmentId).filter(Boolean));

      const active = (data.assignments as any[]).filter((a) => {
        if (a.teacher_id !== payout.teacher_id) return false;
        if (a.salary_linked === false) return false;
        const from = a.effective_from_date || a.start_date;
        const rawEnd = a.effective_to_date
          || ((a.status === 'left' || a.status === 'completed') ? a.status_effective_date : null);
        const to = rawEnd ? format(endOfMonth(parseISO(rawEnd)), 'yyyy-MM-dd') : null;
        if (from && from > monthEnd) return false;
        if (to && to < monthStart) return false;
        return true;
      });

      const activeIds = new Set(active.map((a) => a.id));
      const missing = active
        .filter((a) => !savedIds.has(a.id))
        .map((a) => ({ id: a.id, student: a.profiles?.full_name || 'Unknown', status: a.status }));
      const extra = savedList
        .filter((s: any) => s.assignmentId && !activeIds.has(s.assignmentId))
        .map((s: any) => ({ id: s.assignmentId, student: s.studentName || 'Unknown' }));

      if (missing.length || extra.length) {
        out.push({
          payoutId: payout.id,
          teacherId: payout.teacher_id,
          teacherName: nameById.get(payout.teacher_id) || 'Unknown',
          month: payout.salary_month,
          status: payout.status,
          netSalary: Number(payout.net_salary) || 0,
          missing,
          extra,
        });
      }
    }

    return out.sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Reconciling all saved salary sheets…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <Card className="border-emerald-200">
        <CardContent className="p-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">All saved salary sheets reconcile</p>
            <p className="text-sm text-muted-foreground">
              Every saved sheet contains exactly the assignments that were active in that month.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="font-medium">{rows.length} saved sheet(s) are stale after back-dated changes.</span>
        <span className="text-muted-foreground">Open the month and hit Revise to persist the corrected amount.</span>
      </div>
      {rows.map((r) => (
        <Card key={r.payoutId} className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              <span>{r.teacherName}</span>
              <Badge variant="outline">{r.month}</Badge>
              <Badge variant={r.status === 'paid' ? 'default' : 'secondary'}>{r.status}</Badge>
              <span className="text-muted-foreground font-normal">saved net PKR {r.netSalary.toLocaleString()}</span>
              {onOpenMonth && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => onOpenMonth(r.month)}>
                  Open month
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-sm">
            {r.missing.map((m) => (
              <div key={`m-${m.id}`} className="text-amber-700">
                Missing from sheet: <span className="font-medium">{m.student}</span> ({m.status})
              </div>
            ))}
            {r.extra.map((e) => (
              <div key={`e-${e.id}`} className="text-red-700">
                Should not be billed: <span className="font-medium">{e.student}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default SalarySheetAuditPanel;
