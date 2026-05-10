import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getStatusRule } from '@/lib/assignmentStatusRules';
import { cn } from '@/lib/utils';
import { Calendar, User, GraduationCap, BookOpen, Banknote, Clock, History, FileText, ArrowRight, Activity } from 'lucide-react';

interface Props {
  assignmentId: string | null;
  onClose: () => void;
}

const SELECT = `
  *,
  teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name, email),
  student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, email),
  subject:subjects(id, name),
  division:divisions(id, name),
  parent_assignment:student_teacher_assignments!student_teacher_assignments_parent_assignment_id_fkey(id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name))
`;

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

export function AssignmentDetailDialog({ assignmentId, onClose }: Props) {
  const open = !!assignmentId;

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    enabled: open,
    queryFn: async () => {
      if (!assignmentId) return null;

      const { data: a } = await supabase
        .from('student_teacher_assignments')
        .select(SELECT)
        .eq('id', assignmentId)
        .maybeSingle();
      if (!a) return null;

      const { data: siblings } = await supabase
        .from('student_teacher_assignments')
        .select(SELECT)
        .eq('student_id', (a as any).student_id)
        .order('created_at', { ascending: false });

      const allIds = ((siblings as any[]) || [a]).map((s: any) => s.id);
      const { data: logs } = await supabase
        .from('assignment_audit_log' as any)
        .select('*')
        .in('assignment_id', allIds)
        .order('changed_at', { ascending: false });

      // Hydrate teacher/subject names referenced in old/new values
      const refIds = new Set<string>();
      (logs || []).forEach((l: any) => {
        if (l.field_name === 'teacher_id' || l.field_name === 'subject_id') {
          if (l.old_value) refIds.add(l.old_value);
          if (l.new_value) refIds.add(l.new_value);
        }
        if (l.changed_by) refIds.add(l.changed_by);
      });
      const refIdsArr = Array.from(refIds);
      const [{ data: profs }, { data: subs }] = await Promise.all([
        refIdsArr.length
          ? supabase.from('profiles').select('id, full_name').in('id', refIdsArr)
          : Promise.resolve({ data: [] as any[] }),
        refIdsArr.length
          ? supabase.from('subjects').select('id, name').in('id', refIdsArr)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      const sMap = new Map((subs || []).map((s: any) => [s.id, s.name]));

      const logsByAssignment = new Map<string, any[]>();
      (logs || []).forEach((l: any) => {
        const arr = logsByAssignment.get(l.assignment_id) || [];
        arr.push({
          ...l,
          changed_by_name: l.changed_by ? pMap.get(l.changed_by) : null,
          old_label: resolveLabel(l.field_name, l.old_value, pMap, sMap),
          new_label: resolveLabel(l.field_name, l.new_value, pMap, sMap),
        });
        logsByAssignment.set(l.assignment_id, arr);
      });

      return { a: a as any, siblings: (siblings as any[]) || [], logsByAssignment };
    },
  });

  const previous = (data?.siblings || []).filter((s: any) => s.id !== data?.a.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assignment Details
          </DialogTitle>
          <DialogDescription>Full assignment details with dated status and field change history.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <AssignmentCard a={data.a} logs={data.logsByAssignment.get(data.a.id) || []} current />

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Previous Assignments & Reassignments ({previous.length})
              </h4>
              <Separator />
              {previous.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-3 text-center">No previous assignments for this student.</p>
              ) : (
                <div className="space-y-3">
                  {previous.map((s: any) => (
                    <AssignmentCard key={s.id} a={s} logs={data.logsByAssignment.get(s.id) || []} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function resolveLabel(field: string, value: string | null, pMap: Map<string, any>, sMap: Map<string, any>) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'teacher_id') return pMap.get(value) || value;
  if (field === 'subject_id') return sMap.get(value) || value;
  if (field === 'payout_amount') return Number(value).toLocaleString();
  return value;
}

function AssignmentCard({ a, logs, current = false }: { a: any; logs: any[]; current?: boolean }) {
  const rule = getStatusRule(a.status as any);
  const pa: any = Array.isArray(a.parent_assignment) ? a.parent_assignment[0] : a.parent_assignment;
  const pt = pa ? (Array.isArray(pa.teacher) ? pa.teacher[0] : pa.teacher) : null;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', current ? 'bg-primary/5 border-primary/30' : 'bg-muted/20')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {current && <Badge className="text-[10px]">Current</Badge>}
          <Badge variant="outline" className="gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', rule.dotClass)} />
            {rule.label}
          </Badge>
          {a.transfer_type && a.transfer_type !== 'permanent' && (
            <Badge variant="outline" className="text-[10px] capitalize">{a.transfer_type}</Badge>
          )}
          {a.status_changed_at && (
            <span className="text-[11px] text-muted-foreground">since {formatDisplayDate(a.status_changed_at)}</span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">Created {formatDisplayDate(a.created_at)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Student" value={a.student?.full_name} />
        <InfoRow icon={<User className="h-4 w-4" />} label="Teacher" value={a.teacher?.full_name} />
        <InfoRow icon={<BookOpen className="h-4 w-4" />} label="Subject" value={a.subject?.name || '—'} />
        <InfoRow icon={<FileText className="h-4 w-4" />} label="Division" value={a.division?.name || '—'} />
        <InfoRow
          icon={<Banknote className="h-4 w-4" />}
          label="Payout"
          value={`${Number(a.payout_amount || 0).toLocaleString()} / ${a.payout_type === 'per_class' ? 'class' : 'month'}`}
        />
        <InfoRow icon={<Clock className="h-4 w-4" />} label="Duration" value={`${a.duration_minutes} min`} />
        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Start Date" value={a.start_date ? formatDisplayDate(a.start_date) : '—'} />
        <InfoRow
          icon={<ArrowRight className="h-4 w-4" />}
          label="Effective"
          value={
            a.effective_from_date || a.effective_to_date
              ? `${a.effective_from_date ? formatDisplayDate(a.effective_from_date) : '—'} → ${a.effective_to_date ? formatDisplayDate(a.effective_to_date) : 'ongoing'}`
              : '—'
          }
        />
        <InfoRow icon={<FileText className="h-4 w-4" />} label="Enrollment Ref" value={a.enrollment_ref || '—'} />
        <InfoRow
          icon={<Banknote className="h-4 w-4" />}
          label="Monthly Fee"
          value={a.calculated_monthly_fee ? Number(a.calculated_monthly_fee).toLocaleString() : '—'}
        />
        {a.first_month_prorated_fee ? (
          <InfoRow
            icon={<Banknote className="h-4 w-4" />}
            label="1st Month Prorated"
            value={Number(a.first_month_prorated_fee).toLocaleString()}
          />
        ) : null}
        {a.is_custom_override && (
          <div className="md:col-span-2">
            <Badge variant="outline" className="text-[10px]">Custom Payout Override</Badge>
          </div>
        )}
      </div>

      {pt && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
          Substitute of: <strong>{pt.full_name}</strong>
          {a.substitute_end_date && ` (until ${formatDisplayDate(a.substitute_end_date)})`}
        </div>
      )}

      {a.status_change_reason && (
        <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
          Reason: {a.status_change_reason}
        </div>
      )}

      {/* Activity timeline */}
      <div className="pt-2 border-t border-dashed">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
          <Activity className="h-3.5 w-3.5" />
          Activity Log ({logs.length})
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No activity recorded.</p>
        ) : (
          <ol className="relative border-l border-muted pl-4 space-y-2">
            {logs.map((l: any) => (
              <li key={l.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="text-xs flex flex-wrap items-baseline gap-1.5">
                  <span className="text-muted-foreground">{formatDisplayDate(l.changed_at)}</span>
                  <span className="text-muted-foreground">·</span>
                  {l.event_type === 'created' ? (
                    <span className="font-medium">Assignment created with status <code className="px-1 rounded bg-muted text-[11px]">{l.new_label}</code></span>
                  ) : (
                    <span className="font-medium">
                      {FIELD_LABELS[l.field_name] || l.field_name} changed:{' '}
                      <code className="px-1 rounded bg-muted text-[11px]">{l.old_label ?? '—'}</code>
                      {' → '}
                      <code className="px-1 rounded bg-muted text-[11px]">{l.new_label ?? '—'}</code>
                    </span>
                  )}
                  {l.changed_by_name && (
                    <span className="text-muted-foreground">by {l.changed_by_name}</span>
                  )}
                </div>
                {l.reason && (
                  <div className="text-[11px] text-muted-foreground italic mt-0.5">Reason: {l.reason}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
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
