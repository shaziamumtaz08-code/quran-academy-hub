import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getStatusRule } from '@/lib/assignmentStatusRules';
import { cn } from '@/lib/utils';
import { Calendar, User, GraduationCap, BookOpen, Banknote, Clock, History, FileText, Wallet } from 'lucide-react';

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

      const [
        { data: a },
        { data: history },
      ] = await Promise.all([
        supabase
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
          .maybeSingle(),
        supabase
          .from('assignment_history')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('started_at', { ascending: false }),
      ]);

      if (!a) return null;

      // Hydrate history with teacher/subject names (no FK in DB)
      const teacherIds = Array.from(new Set((history || []).map((h: any) => h.teacher_id).filter(Boolean)));
      const subjectIds = Array.from(new Set((history || []).map((h: any) => h.subject_id).filter(Boolean)));
      const [{ data: hTeachers }, { data: hSubjects }] = await Promise.all([
        teacherIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
          : Promise.resolve({ data: [] as any[] }),
        subjectIds.length
          ? supabase.from('subjects').select('id, name').in('id', subjectIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const tMap = new Map((hTeachers || []).map((t: any) => [t.id, t]));
      const sMap = new Map((hSubjects || []).map((s: any) => [s.id, s]));
      const hydratedHistory = (history || []).map((h: any) => ({
        ...h,
        teacher: tMap.get(h.teacher_id) || null,
        subject: sMap.get(h.subject_id) || null,
      }));

      // Sibling assignments (same student) for full lifecycle
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

      const [
        { data: plan },
        { data: schedules },
        { data: attendance },
        { data: invoices },
        { data: payouts },
      ] = await Promise.all([
        supabase
          .from('student_billing_plans')
          .select('*, fee_packages(name, amount, currency)')
          .eq('assignment_id', assignmentId)
          .maybeSingle(),
        supabase
          .from('schedules')
          .select('day_of_week, student_local_time, duration_minutes, is_active')
          .eq('assignment_id', assignmentId)
          .order('day_of_week'),
        supabase
          .from('attendance')
          .select('id, date, status, total_duration_minutes')
          .eq('student_id', a.student_id)
          .eq('teacher_id', a.teacher_id)
          .order('date', { ascending: false })
          .limit(10),
        supabase
          .from('fee_invoices')
          .select('id, billing_month, amount, amount_paid, status, currency')
          .eq('assignment_id', assignmentId)
          .order('billing_month', { ascending: false }),
        supabase
          .from('salary_payouts')
          .select('id, billing_month, amount, status, currency')
          .eq('teacher_id', a.teacher_id)
          .order('billing_month', { ascending: false })
          .limit(10),
      ]);

      return { a, history: hydratedHistory, siblings: siblings || [], plan, schedules: schedules || [], attendance: attendance || [], invoices: invoices || [], payouts: payouts || [] };
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
          <DialogDescription>Full assignment record, history, billing, attendance & payouts.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header summary */}
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

            <Tabs defaultValue="history">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="payouts"><Wallet className="h-3.5 w-3.5 mr-1" />Payouts</TabsTrigger>
              </TabsList>

              {/* History */}
              <TabsContent value="history" className="space-y-4">
                <Section title="Assignment Lifecycle Events">
                  {data.history.length === 0 ? (
                    <Empty>No transition events recorded.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Started</TableHead>
                          <TableHead>Ended</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.history.map((h: any) => (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs">{formatDisplayDate(h.started_at)}</TableCell>
                            <TableCell className="text-xs">{h.ended_at ? formatDisplayDate(h.ended_at) : <Badge variant="outline" className="text-[10px]">Ongoing</Badge>}</TableCell>
                            <TableCell className="text-xs">{h.teacher?.full_name || '—'}</TableCell>
                            <TableCell className="text-xs">{h.subject?.name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{h.reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>

                <Section title={`All Assignments for ${data.a.student?.full_name} (${data.siblings.length})`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Payout</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.siblings.map((s: any) => (
                        <TableRow key={s.id} className={s.id === data.a.id ? 'bg-primary/5' : ''}>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              </TabsContent>

              {/* Schedule */}
              <TabsContent value="schedule">
                <Section title="Weekly Schedule">
                  {data.schedules.length === 0 ? (
                    <Empty>No schedule configured.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Duration</TableHead><TableHead>Active</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.schedules.map((s: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs capitalize">{s.day_of_week}</TableCell>
                            <TableCell className="text-xs">{s.student_local_time}</TableCell>
                            <TableCell className="text-xs">{s.duration_minutes} min</TableCell>
                            <TableCell><Badge variant={s.is_active ? 'default' : 'outline'} className="text-[10px]">{s.is_active ? 'Yes' : 'No'}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>
              </TabsContent>

              {/* Billing */}
              <TabsContent value="billing" className="space-y-4">
                <Section title="Billing Plan">
                  {!data.plan ? <Empty>No billing plan linked.</Empty> : (
                    <div className="text-sm space-y-1.5 p-3 rounded-lg border bg-muted/20">
                      <div><span className="text-muted-foreground text-xs">Package: </span><strong>{data.plan.fee_packages?.name || '—'}</strong></div>
                      <div><span className="text-muted-foreground text-xs">Net Recurring: </span>{data.plan.currency} {Number(data.plan.net_recurring_fee || 0).toLocaleString()}</div>
                      <div><span className="text-muted-foreground text-xs">Discount: </span>{Number(data.plan.flat_discount || 0).toLocaleString()}</div>
                      <div><span className="text-muted-foreground text-xs">Active: </span>{data.plan.is_active ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </Section>
                <Section title={`Invoices (${data.invoices.length})`}>
                  {data.invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.invoices.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="text-xs">{inv.billing_month}</TableCell>
                            <TableCell className="text-xs">{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{inv.currency} {Number(inv.amount_paid).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{inv.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>
              </TabsContent>

              {/* Attendance */}
              <TabsContent value="attendance">
                <Section title="Recent Attendance (last 10)">
                  {data.attendance.length === 0 ? <Empty>No attendance records.</Empty> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Duration</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.attendance.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{formatDisplayDate(r.date)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge></TableCell>
                            <TableCell className="text-xs">{r.total_duration_minutes ? `${r.total_duration_minutes} min` : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>
              </TabsContent>

              {/* Payouts */}
              <TabsContent value="payouts">
                <Section title={`Teacher Payouts — ${data.a.teacher?.full_name} (last 10)`}>
                  {data.payouts.length === 0 ? <Empty>No payouts recorded.</Empty> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.payouts.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{p.billing_month}</TableCell>
                            <TableCell className="text-xs">{p.currency} {Number(p.amount).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>
              </TabsContent>
            </Tabs>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
