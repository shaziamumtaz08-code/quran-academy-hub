import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportDialog } from '@/components/export/ExportDialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import {
  Users, DollarSign, ChevronDown, ChevronRight, Check, Clock, Download,
  Loader2, Heart, FileText, Calendar, Filter
} from 'lucide-react';

type PeriodMode = 'monthly' | 'weekly' | 'custom';

export default function TeacherPayouts() {
  const qc = useQueryClient();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [payDialog, setPayDialog] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [payRef, setPayRef] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  // Period range
  const periodRange = useMemo(() => {
    if (periodMode === 'monthly') {
      const d = new Date(selectedMonth + '-01');
      return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
    }
    if (periodMode === 'weekly') {
      const now = new Date();
      return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    }
    return { from: customFrom, to: customTo };
  }, [periodMode, selectedMonth, customFrom, customTo]);

  // Fetch payouts
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['teacher-payouts', periodRange.from, periodRange.to],
    enabled: !!periodRange.from && !!periodRange.to,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('teacher_payouts')
        .select('*, teacher:teacher_id(id, full_name, email), course:course_id(name), class:class_id(name)')
        .gte('period_start', periodRange.from)
        .lte('period_end', periodRange.to)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch course class staff for generate
  const { data: classStaff = [] } = useQuery({
    queryKey: ['course-class-staff-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('course_class_staff')
        .select('*, class:class_id(name, course_id, fee_amount, course:course_id(name)), profile:user_id(id, full_name, email, default_payout_rate)')
        .in('staff_role', ['teacher', 'moderator']);
      if (error) throw error;
      return data || [];
    },
  });

  // Group payouts by teacher
  const { grouped, volunteers } = useMemo(() => {
    const filtered = statusFilter === 'all' ? payouts : payouts.filter((p: any) => p.status === statusFilter);
    const vols: any[] = [];
    const teacherMap = new Map<string, { teacher: any; rows: any[]; total: number }>();

    filtered.forEach((p: any) => {
      if (p.payout_type === 'volunteer') {
        vols.push(p);
        return;
      }
      const tid = p.teacher_id;
      if (!teacherMap.has(tid)) {
        teacherMap.set(tid, { teacher: p.teacher, rows: [], total: 0 });
      }
      const entry = teacherMap.get(tid)!;
      entry.rows.push(p);
      entry.total += Number(p.calculated_amount);
    });

    return { grouped: Array.from(teacherMap.entries()), volunteers: vols };
  }, [payouts, statusFilter]);

  // Generate payouts for current period
  const generatePayouts = useMutation({
    mutationFn: async () => {
      if (!periodRange.from || !periodRange.to) return;
      const rows: any[] = [];

      for (const staff of classStaff) {
        const pt = staff.payout_type || 'per_session';
        const rate = Number(staff.profile?.default_payout_rate || 0);
        let amount = 0;
        let sessions = 0;
        let students = 0;

        if (pt === 'volunteer') {
          amount = 0;
        } else if (pt === 'monthly') {
          amount = rate;
        } else if (pt === 'per_session') {
          // Count attendance records as sessions in this period
          const { count } = await (supabase as any)
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', staff.user_id)
            .gte('class_date', periodRange.from)
            .lte('class_date', periodRange.to)
            .eq('status', 'present');
          sessions = count || 0;
          amount = rate * sessions;
        } else if (pt === 'per_student') {
          const { count } = await (supabase as any)
            .from('course_class_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', staff.class_id)
            .eq('status', 'active');
          students = count || 0;
          amount = rate * students;
        }

        rows.push({
          teacher_id: staff.user_id,
          course_id: staff.class?.course_id || null,
          class_id: staff.class_id,
          period_start: periodRange.from,
          period_end: periodRange.to,
          payout_type: pt,
          rate,
          sessions_count: sessions,
          students_count: students,
          calculated_amount: amount,
          status: pt === 'volunteer' ? 'paid' : 'pending',
        });
      }

      if (rows.length > 0) {
        const { error } = await (supabase as any).from('teacher_payouts').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-payouts'] });
      toast({ title: `Payouts generated for ${classStaff.length} staff` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Mark paid
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('teacher_payouts')
        .update({ status: 'paid', paid_reference: payRef.trim() || null, paid_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-payouts'] });
      setPayDialog(null); setPayRef('');
      toast({ title: 'Marked as paid' });
    },
  });

  // Approve
  const approvePayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('teacher_payouts')
        .update({ status: 'approved' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-payouts'] });
      toast({ title: 'Payout approved' });
    },
  });

  const statusBadge = (s: string) => {
    if (s === 'paid') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">Paid</Badge>;
    if (s === 'approved') return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">Approved</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]">Pending</Badge>;
  };

  const totalPending = grouped.reduce((s, [, g]) => s + g.rows.filter(r => r.status !== 'paid').reduce((a, r) => a + Number(r.calculated_amount), 0), 0);
  const totalPaid = grouped.reduce((s, [, g]) => s + g.rows.filter(r => r.status === 'paid').reduce((a, r) => a + Number(r.calculated_amount), 0), 0);

  // Export data
  const exportData = payouts.filter((p: any) => p.payout_type !== 'volunteer').map((p: any) => ({
    teacher: p.teacher?.full_name || '',
    course: p.course?.name || '',
    class: p.class?.name || '',
    period: `${p.period_start} – ${p.period_end}`,
    type: p.payout_type,
    rate: p.rate,
    sessions: p.sessions_count,
    students: p.students_count,
    amount: p.calculated_amount,
    status: p.status,
    reference: p.paid_reference || '',
  }));

  const exportFields = [
    { key: 'teacher', label: 'Teacher' },
    { key: 'course', label: 'Course' },
    { key: 'class', label: 'Class' },
    { key: 'period', label: 'Period' },
    { key: 'type', label: 'Payout Type' },
    { key: 'rate', label: 'Rate' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'students', label: 'Students' },
    { key: 'amount', label: 'Amount (PKR)' },
    { key: 'status', label: 'Status' },
    { key: 'reference', label: 'Reference' },
  ];

  // Month options
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') };
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pending</p>
            <p className="text-lg font-bold text-amber-600">₨{totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Paid</p>
            <p className="text-lg font-bold text-emerald-600">₨{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Teachers</p>
            <p className="text-lg font-bold">{grouped.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Volunteers</p>
            <p className="text-lg font-bold text-muted-foreground">{volunteers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
        <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">This Week</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {periodMode === 'monthly' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {periodMode === 'custom' && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36" />
          </div>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => generatePayouts.mutate()}
            disabled={generatePayouts.isPending}>
            {generatePayouts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Generate Payouts
          </Button>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : grouped.length === 0 && volunteers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No payouts found for this period. Click "Generate Payouts" to calculate from class staff assignments.
        </CardContent></Card>
      ) : (
        <>
          {grouped.length > 0 && (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead className="hidden md:table-cell">Course / Class</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="hidden md:table-cell">Sessions / Students</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map(([teacherId, group]) => {
                      const isExpanded = expandedTeacher === teacherId;
                      const hasMultiple = group.rows.length > 1;

                      return (
                        <React.Fragment key={teacherId}>
                          {/* Aggregated row */}
                          <TableRow className="bg-muted/20 font-medium cursor-pointer"
                            onClick={() => hasMultiple && setExpandedTeacher(isExpanded ? null : teacherId)}>
                            <TableCell className="w-8">
                              {hasMultiple && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                            </TableCell>
                            <TableCell className="font-semibold text-sm">{group.teacher?.full_name || 'Unknown'}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {hasMultiple ? `${group.rows.length} assignments` : (group.rows[0]?.course?.name || '')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {group.rows[0]?.period_start && `${format(new Date(group.rows[0].period_start), 'MMM d')} – ${format(new Date(group.rows[0].period_end), 'MMM d')}`}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs">
                              {group.rows.reduce((s, r) => s + r.sessions_count, 0)} sessions / {group.rows.reduce((s, r) => s + r.students_count, 0)} students
                            </TableCell>
                            <TableCell className="text-right text-xs">—</TableCell>
                            <TableCell className="text-right font-bold">₨{group.total.toLocaleString()}</TableCell>
                            <TableCell>
                              {group.rows.every(r => r.status === 'paid')
                                ? statusBadge('paid')
                                : group.rows.some(r => r.status === 'approved')
                                  ? statusBadge('approved')
                                  : statusBadge('pending')}
                            </TableCell>
                            <TableCell className="text-right">
                              {!hasMultiple && group.rows[0]?.status !== 'paid' && (
                                <div className="flex gap-1 justify-end">
                                  {group.rows[0]?.status === 'pending' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                      onClick={e => { e.stopPropagation(); approvePayout.mutate(group.rows[0].id); }}>
                                      Approve
                                    </Button>
                                  )}
                                  <Button size="sm" className="h-7 text-xs"
                                    onClick={e => { e.stopPropagation(); setPayDialog({ id: group.rows[0].id, name: group.teacher?.full_name, amount: group.rows[0].calculated_amount }); }}>
                                    Mark Paid
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Expanded breakdown */}
                          {isExpanded && hasMultiple && group.rows.map((row: any) => (
                            <TableRow key={row.id} className="bg-muted/5">
                              <TableCell></TableCell>
                              <TableCell className="text-xs pl-8 text-muted-foreground">{row.payout_type}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs">
                                {row.course?.name} / {row.class?.name || '—'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(row.period_start), 'MMM d')} – {format(new Date(row.period_end), 'MMM d')}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs">
                                {row.sessions_count}s / {row.students_count}st
                              </TableCell>
                              <TableCell className="text-right text-xs">₨{Number(row.rate).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-sm font-medium">₨{Number(row.calculated_amount).toLocaleString()}</TableCell>
                              <TableCell>{statusBadge(row.status)}</TableCell>
                              <TableCell className="text-right">
                                {row.status !== 'paid' && (
                                  <div className="flex gap-1 justify-end">
                                    {row.status === 'pending' && (
                                      <Button variant="outline" size="sm" className="h-6 text-[10px]"
                                        onClick={() => approvePayout.mutate(row.id)}>Approve</Button>
                                    )}
                                    <Button size="sm" className="h-6 text-[10px]"
                                      onClick={() => setPayDialog({ id: row.id, name: group.teacher?.full_name, amount: row.calculated_amount })}>
                                      Pay
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Volunteer Teachers */}
          {volunteers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-rose-500" /> Volunteer Teachers
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Course / Class</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {volunteers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-sm">{v.teacher?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.course?.name} / {v.class?.name || '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(v.period_start), 'MMM d')} – {format(new Date(v.period_end), 'MMM d')}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">PKR 0</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Mark Paid Dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Payout as Paid</DialogTitle>
            <DialogDescription>
              {payDialog?.name} — ₨{payDialog?.amount?.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Reference (optional)</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Cheque #, bank transfer ID…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={() => payDialog && markPaid.mutate(payDialog.id)} disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Processing…' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Teacher Payouts"
        fields={exportFields}
        data={exportData}
        filename="teacher-payouts"
      />
    </div>
  );
}
