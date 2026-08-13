import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Loader2, History, Download, RefreshCw } from 'lucide-react';
import { format, parseISO, endOfMonth, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { assignmentMonthWindow, SALARY_ASSIGNMENT_STATUSES } from '@/lib/salaryWindow';
import {
  isPaidLikePayout, fetchSalaryMonthInputs,
  computeSalaryRows, saveUnpaidPayout,
} from '@/lib/salaryCalc';


interface Props {
  onOpenMonth?: (month: string, view?: 'active' | 'archived') => void;
}

type IssueKind = 'no_sheet' | 'missing_students' | 'extra_students' | 'amount_drift';

interface AuditRow {
  key: string;
  payoutId: string | null;
  teacherId: string;
  teacherName: string;
  month: string;
  status: string;
  savedNet: number | null;
  savedTeachingBase: number | null;
  expectedTeachingBase: number;
  missing: { id: string; student: string; status: string; amount: number }[];
  extra: { id: string; student: string }[];
  issues: IssueKind[];
  hasPreviousVersion: boolean;
}

const ISSUE_LABEL: Record<IssueKind, string> = {
  no_sheet: 'No sheet saved',
  missing_students: 'Students missing',
  extra_students: 'Should not be billed',
  amount_drift: 'Amount drift',
};

/**
 * Full cross-month reconciliation of every teacher × month against the assignments
 * that were genuinely active in that month (month-granular end dates, ended
 * assignments still earn salary). Surfaces months where no sheet was ever saved,
 * stale sheets after back-dated changes, and amount drift — with a direct link to
 * the archived (previous) version of each sheet.
 */
export function SalarySheetAuditPanel({ onOpenMonth }: Props) {
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ['salary-sheet-audit-full'],
    queryFn: async () => {
      const [payoutsRes, assignRes] = await Promise.all([
        supabase
          .from('salary_payouts')
          .select('id, teacher_id, salary_month, status, net_salary, base_salary, calculation_json, is_archived, voided_at'),
        supabase
          .from('student_teacher_assignments')
          .select('id, teacher_id, student_id, status, salary_linked, payout_amount, payout_type, effective_from_date, effective_to_date, status_effective_date, start_date, profiles!student_teacher_assignments_student_id_fkey(full_name)')
          .in('status', [...SALARY_ASSIGNMENT_STATUSES]),
      ]);

      const teacherIds = Array.from(
        new Set([
          ...(payoutsRes.data || []).map((p: any) => p.teacher_id),
          ...(assignRes.data || []).map((a: any) => a.teacher_id),
        ]),
      ).filter(Boolean);

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
    const assignments = data.assignments as any[];
    if (!assignments.length) return [];

    // Month range: earliest assignment start → current month
    const starts = assignments
      .map((a) => a.effective_from_date || a.start_date)
      .filter(Boolean)
      .sort();
    const first = starts[0] ? startOfMonth(parseISO(starts[0])) : startOfMonth(new Date());
    const months = eachMonthOfInterval({ start: first, end: startOfMonth(new Date()) }).map((d) =>
      format(d, 'yyyy-MM'),
    );

    const activePayouts = (data.payouts as any[]).filter((p) => !p.is_archived && !p.voided_at);
    const archivedByKey = new Set(
      (data.payouts as any[])
        .filter((p) => p.is_archived || p.voided_at)
        .map((p) => `${p.teacher_id}|${p.salary_month}`),
    );
    const payoutByKey = new Map<string, any>(
      activePayouts.map((p) => [`${p.teacher_id}|${p.salary_month}`, p]),
    );

    const teacherIds = Array.from(new Set(assignments.map((a) => a.teacher_id).filter(Boolean)));
    const out: AuditRow[] = [];

    for (const teacherId of teacherIds) {
      const mine = assignments.filter((a) => a.teacher_id === teacherId);
      for (const month of months) {
        const monthStart = `${month}-01`;
        const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
        const daysInMonth = Number(monthEnd.slice(-2));

        const active = mine.filter((a) => {
          if (a.salary_linked === false) return false;
          return assignmentMonthWindow(a, monthStart, monthEnd) !== null;
        });
        if (!active.length) continue;

        const expectedByAssignment = new Map<string, number>();
        for (const a of active) {
          const win = assignmentMonthWindow(a, monthStart, monthEnd)!;
          const days =
            Math.floor(
              (parseISO(win.dateTo).getTime() - parseISO(win.dateFrom).getTime()) / 86400000,
            ) + 1;
          const rate = Number(a.payout_amount) || 0;
          const amount =
            (a.payout_type || 'monthly') === 'monthly' ? (rate / daysInMonth) * days : 0;
          expectedByAssignment.set(a.id, Math.round(amount));
        }
        const expectedTeachingBase = Array.from(expectedByAssignment.values()).reduce((s, v) => s + v, 0);

        const key = `${teacherId}|${month}`;
        const payout = payoutByKey.get(key);
        const savedList: any[] = payout?.calculation_json?.students || [];
        const savedIds = new Set(savedList.map((s: any) => s.assignmentId).filter(Boolean));
        const savedTeachingBase = payout
          ? savedList.reduce(
              (s: number, r: any) => s + Number(r.editedAmount ?? r.calculatedAmount ?? 0),
              0,
            )
          : null;

        const activeIds = new Set(active.map((a) => a.id));
        const missing = payout
          ? active
              .filter((a) => !savedIds.has(a.id))
              .map((a) => ({
                id: a.id,
                student: a.profiles?.full_name || 'Unknown',
                status: a.status,
                amount: expectedByAssignment.get(a.id) || 0,
              }))
          : active.map((a) => ({
              id: a.id,
              student: a.profiles?.full_name || 'Unknown',
              status: a.status,
              amount: expectedByAssignment.get(a.id) || 0,
            }));
        const extra = savedList
          .filter((s: any) => s.assignmentId && !activeIds.has(s.assignmentId))
          .map((s: any) => ({ id: s.assignmentId, student: s.studentName || 'Unknown' }));

        const issues: IssueKind[] = [];
        if (!payout) issues.push('no_sheet');
        if (payout && missing.length) issues.push('missing_students');
        if (extra.length) issues.push('extra_students');
        if (
          payout &&
          savedTeachingBase !== null &&
          Math.abs(savedTeachingBase - expectedTeachingBase) > 1 &&
          !missing.length &&
          !extra.length
        ) {
          issues.push('amount_drift');
        }

        out.push({
          key,
          payoutId: payout?.id ?? null,
          teacherId,
          teacherName: nameById.get(teacherId) || 'Unknown',
          month,
          status: payout?.status || 'not generated',
          savedNet: payout ? Number(payout.net_salary) || 0 : null,
          savedTeachingBase,
          expectedTeachingBase,
          missing,
          extra,
          issues,
          hasPreviousVersion: archivedByKey.has(key),
        });
      }
    }

    return out.sort((a, b) =>
      a.month === b.month ? a.teacherName.localeCompare(b.teacherName) : a.month < b.month ? 1 : -1,
    );
  }, [data]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.teacherId, r.teacherName));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const scoped = useMemo(
    () =>
      rows.filter((r) => {
        if (monthFrom && r.month < monthFrom) return false;
        if (monthTo && r.month > monthTo) return false;
        if (teacherFilter !== 'all' && r.teacherId !== teacherFilter) return false;
        if (issueFilter !== 'all' && !r.issues.includes(issueFilter as IssueKind)) return false;
        return true;
      }),
    [rows, monthFrom, monthTo, teacherFilter, issueFilter],
  );

  const visible = onlyIssues ? scoped.filter((r) => r.issues.length) : scoped;


  const exportCsv = () => {
    const header = [
      'Teacher',
      'Month',
      'Sheet status',
      'Saved net (PKR)',
      'Saved teaching base',
      'Expected teaching base',
      'Issues',
      'Missing students',
      'Should not be billed',
    ];
    const lines = visible.map((r) =>
      [
        r.teacherName,
        r.month,
        r.status,
        r.savedNet ?? '',
        r.savedTeachingBase ?? '',
        r.expectedTeachingBase,
        r.issues.map((i) => ISSUE_LABEL[i]).join('; '),
        r.missing.map((m) => `${m.student} (${m.status}, ${m.amount})`).join('; '),
        r.extra.map((e) => e.student).join('; '),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-sheet-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Rows we are allowed to auto-fix: flagged, and not already paid/locked money.
  const flaggedRows = scoped.filter((r) => r.issues.length);
  const eligibleRows = flaggedRows.filter((r) => !isPaidLikePayout(r.status));
  const skippedCount = flaggedRows.length - eligibleRows.length;

  const runBulkRegenerate = async () => {
    setConfirmOpen(false);
    const total = eligibleRows.length;
    if (!total) return;
    setProgress({ done: 0, total });

    const failures: string[] = [];
    let saved = 0;

    // One fetch per distinct month, reused for every teacher flagged in that month.
    const byMonth = new Map<string, AuditRow[]>();
    for (const r of eligibleRows) {
      byMonth.set(r.month, [...(byMonth.get(r.month) || []), r]);
    }

    let done = 0;
    for (const [month, monthRows] of byMonth) {
      let computed: ReturnType<typeof computeSalaryRows> = [];
      let existingPayouts: any[] = [];
      try {
        const inputs = await fetchSalaryMonthInputs(month);
        existingPayouts = inputs.existingPayouts;
        computed = computeSalaryRows(inputs);
      } catch (e: any) {
        monthRows.forEach((r) => failures.push(`${r.teacherName} ${month}: ${e?.message || 'load failed'}`));
        done += monthRows.length;
        setProgress({ done, total });
        continue;
      }

      for (const r of monthRows) {
        try {
          const teacherRow = computed.find((t) => t.teacherId === r.teacherId);
          if (!teacherRow) throw new Error('no calculable rows for this month');
          const existing = existingPayouts.find((p: any) => p.teacher_id === r.teacherId) || null;
          await saveUnpaidPayout(teacherRow, month, existing);
          saved++;
        } catch (e: any) {
          failures.push(`${r.teacherName} ${month}: ${e?.message || 'save failed'}`);
        }
        done++;
        setProgress({ done, total });
      }
    }

    setProgress(null);
    await queryClient.invalidateQueries({ queryKey: ['salary-sheet-audit-full'] });
    await queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    await queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });

    toast({
      title: 'Bulk regeneration complete',
      description: `${saved} sheet(s) saved, ${skippedCount} skipped (already paid/locked), ${failures.length} failed.${
        failures.length ? ` First failure: ${failures[0]}` : ''
      }`,
      variant: failures.length ? 'destructive' : undefined,
    });
    if (failures.length) console.warn('[salary bulk regenerate] failures:', failures);
  };



  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Auditing every teacher × month against active assignments…
      </div>
    );
  }

  const issueCount = scoped.filter((r) => r.issues.length).length;
  const totalIssueCount = rows.filter((r) => r.issues.length).length;
  const filtersActive = !!monthFrom || !!monthTo || teacherFilter !== 'all' || issueFilter !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">From month</label>
          <Input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">To month</label>
          <Input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Staff member</label>
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All staff</SelectItem>
              {teacherOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Issue type</label>
          <Select value={issueFilter} onValueChange={setIssueFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All issues</SelectItem>
              {(Object.keys(ISSUE_LABEL) as IssueKind[]).map((k) => (
                <SelectItem key={k} value={k}>{ISSUE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtersActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setMonthFrom(''); setMonthTo(''); setTeacherFilter('all'); setIssueFilter('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {issueCount ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-medium">
              {issueCount} teacher-month sheet(s) need review
              {filtersActive ? ` (of ${totalIssueCount} overall)` : ''}.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">
              {filtersActive ? 'No revisions due for this filter.' : 'Every month reconciles with its active assignments.'}
            </span>
          </>
        )}
        <span className="text-muted-foreground">Open the month, verify, then save to persist the revised sheet.</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={!eligibleRows.length || progress !== null}
          >
            {progress ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving {progress.done} of {progress.total}…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate &amp; Save All Flagged ({eligibleRows.length})
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOnlyIssues((v) => !v)}>
            {onlyIssues ? `Show all ${scoped.length}` : 'Show issues only'}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate {eligibleRows.length} salary sheet(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will regenerate and save {eligibleRows.length} salary sheets. Already-paid/locked sheets are skipped
              {skippedCount ? ` (${skippedCount} will be skipped and must be revised manually with a reason)` : ''}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkRegenerate}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {!visible.length && (
        <Card className="border-emerald-200">
          <CardContent className="p-6 text-sm text-muted-foreground">Nothing to review.</CardContent>
        </Card>
      )}

      {visible.map((r) => (
        <Card key={r.key} className={r.issues.length ? 'border-amber-200' : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              <span>{r.teacherName}</span>
              <Badge variant="outline">{r.month}</Badge>
              <Badge variant={r.status === 'paid' ? 'default' : 'secondary'}>{r.status}</Badge>
              {r.issues.map((i) => (
                <Badge key={i} variant="outline" className="border-amber-300 text-amber-700">
                  {ISSUE_LABEL[i]}
                </Badge>
              ))}
              <span className="text-muted-foreground font-normal">
                saved {r.savedTeachingBase != null ? `PKR ${r.savedTeachingBase.toLocaleString()}` : '—'} · expected PKR{' '}
                {r.expectedTeachingBase.toLocaleString()}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {r.hasPreviousVersion && onOpenMonth && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => onOpenMonth(r.month, 'archived')}
                  >
                    <History className="h-3.5 w-3.5 mr-1" /> Previous version
                  </Button>
                )}
                {onOpenMonth && (
                  <Button size="sm" variant="outline" onClick={() => onOpenMonth(r.month, 'active')}>
                    Open month
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-sm">
            {r.missing.map((m) => (
              <div key={`m-${m.id}`} className="text-amber-700">
                {r.payoutId ? 'Missing from sheet' : 'Unpaid / never generated'}:{' '}
                <span className="font-medium">{m.student}</span> ({m.status}) — PKR {m.amount.toLocaleString()}
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
