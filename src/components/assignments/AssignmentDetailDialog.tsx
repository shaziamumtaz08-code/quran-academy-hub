import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getStatusRule } from '@/lib/assignmentStatusRules';
import { cn } from '@/lib/utils';
import { Calendar, User, GraduationCap, BookOpen, Banknote, Clock, History, FileText } from 'lucide-react';

interface Props {
  assignmentId: string | null;
  onClose: () => void;
}

export function AssignmentDetailDialog({ assignmentId, onClose }: Props) {
  const open = !!assignmentId;

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    enabled: open,
    queryFn: async () => {
      if (!assignmentId) return null;

      const { data: a } = await supabase
        .from('student_teacher_assignments')
        .select(`
          *,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name, email),
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, email),
          subject:subjects(id, name),
          division:divisions(id, name),
          parent_assignment:student_teacher_assignments!student_teacher_assignments_parent_assignment_id_fkey(id, teacher_id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name))
        `)
        .eq('id', assignmentId)
        .maybeSingle();

      if (!a) return null;

      // Sibling assignments (same student) — previous assignments / reassignments
      const { data: siblings } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id, status, created_at, status_changed_at, status_change_reason,
          payout_amount, payout_type, transfer_type,
          effective_from_date, effective_to_date,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          subject:subjects(name)
        `)
        .eq('student_id', a.student_id)
        .order('created_at', { ascending: false });

      return { a, siblings: siblings || [] };
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assignment Details
          </DialogTitle>
          <DialogDescription>Current assignment and previous assignments / reassignments for this student.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current assignment summary */}
            <div className="rounded-xl border bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Student" value={data.a.student?.full_name} />
              <InfoRow icon={<User className="h-4 w-4" />} label="Teacher" value={data.a.teacher?.full_name} />
              <InfoRow icon={<BookOpen className="h-4 w-4" />} label="Subject" value={data.a.subject?.name || '—'} />
              <InfoRow icon={<Banknote className="h-4 w-4" />} label="Payout" value={`${Number(data.a.payout_amount || 0).toLocaleString()} / ${data.a.payout_type === 'per_class' ? 'class' : 'mo'}`} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Duration" value={`${data.a.duration_minutes} min`} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Start Date" value={data.a.start_date ? formatDisplayDate(data.a.start_date) : '—'} />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Status</span>
                <Badge variant="outline" className="gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', getStatusRule(data.a.status as any).dotClass)} />
                  {getStatusRule(data.a.status as any).label}
                </Badge>
                {data.a.status_changed_at && (
                  <span className="text-[11px] text-muted-foreground">since {formatDisplayDate(data.a.status_changed_at)}</span>
                )}
              </div>
              <InfoRow icon={<FileText className="h-4 w-4" />} label="Enrollment Ref" value={data.a.enrollment_ref || '—'} />
              {(() => {
                const pa: any = Array.isArray(data.a.parent_assignment) ? data.a.parent_assignment[0] : data.a.parent_assignment;
                if (!pa) return null;
                const pt = Array.isArray(pa.teacher) ? pa.teacher[0] : pa.teacher;
                return (
                  <div className="md:col-span-2 text-xs text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                    Substitute of: <strong>{pt?.full_name}</strong>
                    {data.a.substitute_end_date && ` (until ${formatDisplayDate(data.a.substitute_end_date)})`}
                  </div>
                );
              })()}
              {data.a.status_change_reason && (
                <div className="md:col-span-2 text-xs text-muted-foreground italic">Reason: {data.a.status_change_reason}</div>
              )}
            </div>

            {/* Previous assignments / reassignments */}
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Previous Assignments & Reassignments ({Math.max(0, data.siblings.length - 1)})
                </span>
              }
            >
              {data.siblings.filter((s: any) => s.id !== data.a.id).length === 0 ? (
                <Empty>No previous assignments for this student.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.siblings
                      .filter((s: any) => s.id !== data.a.id)
                      .map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{formatDisplayDate(s.created_at)}</TableCell>
                          <TableCell className="text-xs">{s.teacher?.full_name}</TableCell>
                          <TableCell className="text-xs">{s.subject?.name || '—'}</TableCell>
                          <TableCell className="text-xs">{Number(s.payout_amount || 0).toLocaleString()}/{s.payout_type === 'per_class' ? 'cls' : 'mo'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1.5 text-[10px]">
                              <span className={cn('h-1.5 w-1.5 rounded-full', getStatusRule(s.status as any).dotClass)} />
                              {getStatusRule(s.status as any).label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.status_change_reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <Separator />
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic py-3 text-center">{children}</p>;
}
