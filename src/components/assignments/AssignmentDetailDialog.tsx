import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAssignmentPayouts } from '@/lib/assignmentPayouts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { getStatusRule } from '@/lib/assignmentStatusRules';
import { cn } from '@/lib/utils';
import {
  Calendar, User, GraduationCap, BookOpen, Banknote, Clock, History, FileText,
  ArrowRight, Loader2, AlertCircle, MapPin, Mail, Globe, Phone,
} from 'lucide-react';

interface Props {
  assignmentId: string | null;
  onClose: () => void;
}

export function AssignmentDetailDialog({ assignmentId, onClose }: Props) {
  const open = !!assignmentId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['assignment-detail-v2', assignmentId],
    enabled: open,
    queryFn: async () => {
      if (!assignmentId) return null;

      // 1. Assignment row
      const { data: a, error: aErr } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, subject_id, division_id, branch_id, status, created_at, start_date, effective_from_date, effective_to_date, status_effective_date, status_change_reason, duration_minutes, salary_linked, is_temporary, temp_start_date, temp_end_date, transfer_type, parent_assignment_id, original_assignment_id, substitute_end_date, requires_schedule, requires_planning, requires_attendance, fee_package_id')
        .eq('id', assignmentId)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!a) throw new Error('Assignment not found');
      const payout = (await fetchAssignmentPayouts([assignmentId])).get(assignmentId) || { payout_amount: null, payout_type: null };
      (a as any).payout_amount = payout.payout_amount;
      (a as any).payout_type = payout.payout_type;

      // Lineage: every assignment row for this student + subject. A teacher transfer
      // closes one row and opens another, so the earlier periods live on sibling rows.
      // History scoped to a single row would only ever show the latest instance.
      let lineage: any[] = [a];
      if (a.student_id) {
        let q = supabase
          .from('student_teacher_assignments')
          .select('id, teacher_id, status, created_at, start_date, effective_from_date, effective_to_date, status_change_reason, transfer_type, is_temporary')
          .eq('student_id', a.student_id);
        q = a.subject_id ? q.eq('subject_id', a.subject_id) : q.is('subject_id', null);
        const { data: sib } = await q.order('created_at', { ascending: true });
        if (sib?.length) lineage = sib;
      }
      const lineageIds = Array.from(new Set(lineage.map((r: any) => r.id)));

      // 2-6. Parallel independent fetches
      const [studentRes, teacherRes, subjectRes, divisionRes, historyRes, schedulesRes, auditRes] =
        await Promise.all([
          a.student_id
            ? supabase.from('profiles').select('id, full_name, email, timezone, country, city').eq('id', a.student_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          a.teacher_id
            ? supabase.from('profiles').select('id, full_name, email, timezone').eq('id', a.teacher_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          a.subject_id
            ? supabase.from('subjects').select('id, name').eq('id', a.subject_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          a.division_id
            ? supabase.from('divisions').select('id, name').eq('id', a.division_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from('assignment_history').select('*').in('assignment_id', lineageIds).order('created_at', { ascending: false }),
          supabase.from('schedules').select('*').eq('assignment_id', assignmentId),
          supabase.from('assignment_audit_log' as any).select('*').in('assignment_id', lineageIds).order('changed_at', { ascending: false }),
        ]);


      // Resolve teacher names referenced inside history rows
      const histRows = (historyRes.data as any[]) || [];
      const teacherIds = Array.from(new Set(histRows.map((h) => h.teacher_id).filter(Boolean)));
      const subjectIds = Array.from(new Set(histRows.map((h) => h.subject_id).filter(Boolean)));

      // Also pull names for audit_log changed_by + teacher_id field changes
      const auditRows = (auditRes.data as any[]) || [];
      const auditPersonIds = new Set<string>();
      auditRows.forEach((r) => {
        if (r.changed_by) auditPersonIds.add(r.changed_by);
        if (r.field_name === 'teacher_id') {
          if (r.old_value) auditPersonIds.add(r.old_value);
          if (r.new_value) auditPersonIds.add(r.new_value);
        }
      });
      const auditSubjectIds = new Set<string>();
      auditRows.forEach((r) => {
        if (r.field_name === 'subject_id') {
          if (r.old_value) auditSubjectIds.add(r.old_value);
          if (r.new_value) auditSubjectIds.add(r.new_value);
        }
      });

      const allProfileIds = Array.from(new Set([
        ...teacherIds,
        ...Array.from(auditPersonIds),
        ...lineage.map((r: any) => r.teacher_id).filter(Boolean),
      ]));
      const allSubjectIds = Array.from(new Set([...subjectIds, ...Array.from(auditSubjectIds)]));

      const [profilesRes, subjectsRes] = await Promise.all([
        allProfileIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', allProfileIds)
          : Promise.resolve({ data: [] as any[] }),
        allSubjectIds.length
          ? supabase.from('subjects').select('id, name').in('id', allSubjectIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pMap = new Map(((profilesRes.data as any[]) || []).map((p) => [p.id, p.full_name]));
      const sMap = new Map(((subjectsRes.data as any[]) || []).map((s) => [s.id, s.name]));

      return {
        a,
        student: studentRes.data,
        teacher: teacherRes.data,
        subject: subjectRes.data,
        division: divisionRes.data,
        history: histRows,
        schedules: (schedulesRes.data as any[]) || [],
        audit: auditRows,
        lineage,
        pMap,
        sMap,
      };
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assignment Details
          </DialogTitle>
          <DialogDescription>Full assignment record with status, payout, schedule, and complete change history.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading assignment details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-medium">Failed to load assignment</p>
            <p className="text-xs text-muted-foreground">{(error as any)?.message || 'Unknown error'}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <DetailsPanel data={data} />
            <LineagePanel data={data} />
            <HistoryPanel data={data} />

          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailsPanel({ data }: { data: any }) {
  const { a, student, teacher, subject, division } = data;
  const rule = getStatusRule(a.status as any);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assignment</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', rule.dotClass)} />
            {rule.label}
          </Badge>
          {a.transfer_type && a.transfer_type !== 'permanent' && (
            <Badge variant="outline" className="text-[10px] capitalize">{a.transfer_type}</Badge>
          )}
        </div>
      </header>

      <Separator />

      {/* People */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PersonCard icon={<GraduationCap className="h-4 w-4" />} title="Student" person={student} showLocation />
        <PersonCard icon={<User className="h-4 w-4" />} title="Teacher" person={teacher} />
      </div>

      <Separator />

      {/* Core fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
        <InfoRow icon={<BookOpen className="h-4 w-4" />} label="Subject" value={subject?.name} />
        <InfoRow icon={<FileText className="h-4 w-4" />} label="Division" value={division?.name} />
        <InfoRow icon={<Clock className="h-4 w-4" />} label="Duration" value={a.duration_minutes ? `${a.duration_minutes} min` : null} />
        <InfoRow icon={<FileText className="h-4 w-4" />} label="Enrollment Ref" value={a.enrollment_ref} />
        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Start Date" value={a.start_date ? formatDisplayDate(a.start_date) : null} />
        <InfoRow
          icon={<ArrowRight className="h-4 w-4" />}
          label="Effective"
          value={
            a.effective_from_date || a.effective_to_date
              ? `${a.effective_from_date ? formatDisplayDate(a.effective_from_date) : '—'} → ${a.effective_to_date ? formatDisplayDate(a.effective_to_date) : 'ongoing'}`
              : null
          }
        />
        <InfoRow
          icon={<Banknote className="h-4 w-4" />}
          label="Payout"
          value={`${Number(a.payout_amount || 0).toLocaleString()} / ${a.payout_type === 'per_class' ? 'class' : 'month'}`}
        />
        <InfoRow
          icon={<Banknote className="h-4 w-4" />}
          label="Monthly Fee"
          value={a.calculated_monthly_fee ? Number(a.calculated_monthly_fee).toLocaleString() : null}
        />
        {a.first_month_prorated_fee ? (
          <InfoRow
            icon={<Banknote className="h-4 w-4" />}
            label="1st Month Prorated"
            value={Number(a.first_month_prorated_fee).toLocaleString()}
          />
        ) : null}
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-2 pt-1">
        {a.requires_schedule && <Badge variant="outline" className="text-[10px]">Requires Schedule</Badge>}
        {a.requires_planning && <Badge variant="outline" className="text-[10px]">Requires Planning</Badge>}
        {a.requires_attendance && <Badge variant="outline" className="text-[10px]">Requires Attendance</Badge>}
        {a.is_custom_override && <Badge variant="outline" className="text-[10px]">Custom Payout Override</Badge>}
      </div>

      {a.status_change_reason && (
        <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3 py-1">
          Status reason: {a.status_change_reason}
        </div>
      )}

      {/* Schedules */}
      {data.schedules.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Schedules ({data.schedules.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.schedules.map((s: any) => (
                <Badge key={s.id} variant="outline" className="text-[11px] gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span className="capitalize">{s.day_of_week}</span> · {s.student_local_time?.slice(0, 5)}
                  {!s.is_active && <span className="text-muted-foreground">(inactive)</span>}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Full teacher lineage for this student + subject. A transfer closes one assignment
 * row and opens a new one, so earlier periods would otherwise be invisible here.
 */
function LineagePanel({ data }: { data: any }) {
  const { lineage = [], a, pMap } = data;
  if (!lineage || lineage.length <= 1) return null;
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <header className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Teacher Timeline ({lineage.length})
        </h3>
      </header>
      <ol className="space-y-2">
        {lineage.map((r: any) => {
          const rule = getStatusRule(r.status as any);
          const isCurrent = r.id === a.id;
          return (
            <li
              key={r.id}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm',
                isCurrent ? 'border-primary/40 bg-primary/5' : 'bg-muted/10',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', rule.dotClass)} />
              <span className="font-medium">{pMap.get(r.teacher_id) || 'Unknown teacher'}</span>
              <span className="text-xs text-muted-foreground">
                {r.effective_from_date || r.start_date ? formatDisplayDate(r.effective_from_date || r.start_date) : '—'}
                {' → '}
                {r.effective_to_date ? formatDisplayDate(r.effective_to_date) : 'ongoing'}
              </span>
              <Badge variant="outline" className="text-[10px]">{rule.label}</Badge>
              {r.is_temporary && <Badge variant="outline" className="text-[10px]">Temporary</Badge>}
              {isCurrent && <Badge variant="outline" className="text-[10px]">Viewing</Badge>}
              {r.status_change_reason && (
                <span className="basis-full text-xs italic text-muted-foreground">{r.status_change_reason}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}


function HistoryPanel({ data }: { data: any }) {
  const { history, audit, pMap, sMap, a, lineage = [] } = data;
  const teacherOfRow = (rowAssignmentId: string) => {
    const row = lineage.find((r: any) => r.id === rowAssignmentId);
    return row ? pMap.get(row.teacher_id) : null;
  };
  const OtherRecordBadge = ({ rowAssignmentId }: { rowAssignmentId: string }) =>
    rowAssignmentId && rowAssignmentId !== a.id ? (
      <Badge variant="outline" className="ml-2 text-[10px] font-normal">
        {teacherOfRow(rowAssignmentId) || 'earlier record'}
      </Badge>
    ) : null;

  const FIELD_LABELS: Record<string, string> = {
    status: 'Status',
    payout_amount: 'Payout',
    payout_type: 'Payout Type',
    effective_from_date: 'Effective From',
    effective_to_date: 'Effective To',
    teacher_id: 'Teacher',
    subject_id: 'Subject',
    duration_minutes: 'Duration (min)',
    transfer_type: 'Transfer Type',
    start_date: 'Start Date',
  };

  const resolveLabel = (field: string, value: string | null) => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'teacher_id') return pMap.get(value) || value;
    if (field === 'subject_id') return sMap.get(value) || value;
    if (field === 'payout_amount') return Number(value).toLocaleString();
    return value;
  };

  const totalRows = history.length + audit.length;

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <header className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Change History ({totalRows})
        </h3>
      </header>

      {totalRows === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <History className="h-8 w-8 opacity-40" />
          <p className="text-sm">No history recorded yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Previous</TableHead>
              <TableHead>New</TableHead>
              <TableHead>By / Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.map((r: any) => (
              <TableRow key={`a-${r.id}`}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {r.changed_at ? formatDisplayDateTime(r.changed_at) : '—'}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {r.event_type === 'created' ? 'Assignment created' : (FIELD_LABELS[r.field_name] || r.field_name)}
                  <OtherRecordBadge rowAssignmentId={r.assignment_id} />

                </TableCell>
                <TableCell className="text-xs"><code className="px-1 rounded bg-muted">{resolveLabel(r.field_name, r.old_value)}</code></TableCell>
                <TableCell className="text-xs"><code className="px-1 rounded bg-muted">{resolveLabel(r.field_name, r.new_value)}</code></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.changed_by ? pMap.get(r.changed_by) || '—' : '—'}
                  {r.reason && <div className="italic mt-0.5">{r.reason}</div>}
                </TableCell>
              </TableRow>
            ))}
            {history.map((h: any) => (
              <TableRow key={`h-${h.id}`}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {h.created_at ? formatDisplayDateTime(h.created_at) : '—'}
                </TableCell>
                <TableCell className="text-sm font-medium">Assignment period</TableCell>
                <TableCell className="text-xs">
                  {h.started_at ? formatDisplayDate(h.started_at) : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {h.ended_at ? formatDisplayDate(h.ended_at) : 'ongoing'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {h.teacher_id ? pMap.get(h.teacher_id) || '—' : '—'}
                  {h.reason && <div className="italic mt-0.5">{h.reason}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function PersonCard({
  icon, title, person, showLocation,
}: { icon: React.ReactNode; title: string; person: any; showLocation?: boolean }) {
  if (!person) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}{title}
        </div>
        <p className="text-sm italic text-muted-foreground mt-2">Not available</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/10 p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}{title}
      </div>
      <p className="text-sm font-semibold">{person.full_name || '—'}</p>
      {person.email && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{person.email}</p>
      )}
      {(person as any).whatsapp_number && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{(person as any).whatsapp_number}</p>
      )}
      {person.timezone && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Globe className="h-3 w-3" />{person.timezone}</p>
      )}
      {showLocation && (person.city || person.country) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />{[person.city, person.country].filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground text-xs shrink-0">{label}:</span>
      <span className="font-medium truncate">{value || '—'}</span>
    </div>
  );
}
