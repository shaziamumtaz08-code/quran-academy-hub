import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calculator, DollarSign, Users, Lock, CheckCircle, Clock,
  Plus, Search, Loader2, ChevronDown, ChevronRight, Eye, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const now = new Date();
const currentSalaryMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

interface StudentPayoutRow {
  studentId: string;
  studentName: string;
  assignmentId: string;
  dateFrom: string;
  dateTo: string;
  payoutRate: number;
  payoutType: string;
  eligibleDays: number;
  totalDays: number;
  calculatedAmount: number;
  editedAmount: number | null;
  attendanceDays: { date: string; status: string }[];
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  rescheduledCount: number;
  missingCount: number;
  feeStatus: string;
  lastPaymentDate: string | null;
}

interface TeacherSalaryRow {
  teacherId: string;
  teacherName: string;
  students: StudentPayoutRow[];
  baseSalary: number;
  extraClassAmount: number;
  adjustmentAmount: number;
  deductions: number;
  netSalary: number;
  payoutStatus: string;
}

export default function SalaryEngine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [extraClassModalOpen, setExtraClassModalOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherSalaryRow | null>(null);

  // Forms
  const [leaveForm, setLeaveForm] = useState({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '' });
  const [extraClassForm, setExtraClassForm] = useState({ teacher_id: '', student_id: '', class_date: '', duration_minutes: '30', rate: '', reason: '' });
  const [adjForm, setAdjForm] = useState({ teacher_id: '', adjustment_type: 'bonus', amount: '', reason: '' });
  const [payMethod, setPayMethod] = useState('');
  const [payRef, setPayRef] = useState('');

  const [year, month] = salaryMonth.split('-').map(Number);
  const monthStart = `${salaryMonth}-01`;
  const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDatesInMonth = eachDayOfInterval({ start: parseISO(monthStart), end: parseISO(monthEnd) });

  // ── Data Queries ──

  const { data: teachers = [] } = useQuery({
    queryKey: ['salary-teachers'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, payout_amount, payout_type, effective_from_date, effective_to_date, status, profiles!student_teacher_assignments_student_id_fkey(full_name)')
        .in('status', ['active', 'paused', 'completed']);
      return data || [];
    },
  });

  const { data: assignmentHistory = [] } = useQuery({
    queryKey: ['assignment-history-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_history')
        .select('*, student_teacher_assignments(payout_amount, payout_type, student_id, profiles!student_teacher_assignments_student_id_fkey(full_name))')
        .or(`ended_at.is.null,ended_at.gte.${monthStart}`)
        .lte('started_at', monthEnd);
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('id, teacher_id, student_id, class_date, status')
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);
      return data || [];
    },
  });

  const { data: leaveEvents = [] } = useQuery({
    queryKey: ['leave-events-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_events')
        .select('*')
        .lte('start_date', monthEnd)
        .gte('end_date', monthStart)
        .eq('status', 'approved');
      return data || [];
    },
  });

  const { data: extraClasses = [] } = useQuery({
    queryKey: ['extra-classes-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd)
        .eq('status', 'approved');
      return data || [];
    },
  });

  const { data: salaryAdjustments = [] } = useQuery({
    queryKey: ['salary-adjustments', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_adjustments')
        .select('*')
        .eq('salary_month', salaryMonth);
      return data || [];
    },
  });

  const { data: existingPayouts = [] } = useQuery({
    queryKey: ['salary-payouts', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_payouts')
        .select('*')
        .eq('salary_month', salaryMonth);
      return data || [];
    },
  });

  const { data: feeInvoices = [] } = useQuery({
    queryKey: ['fee-invoices-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('student_id, status, paid_at')
        .eq('billing_month', salaryMonth);
      return data || [];
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['all-students-salary'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
  });

  // ── Calculation Engine ──

  const salaryData: TeacherSalaryRow[] = useMemo(() => {
    return teachers.map(teacher => {
      const teacherAssignments = assignments.filter((a: any) => a.teacher_id === teacher.id);

      const studentRows: StudentPayoutRow[] = teacherAssignments.map((assign: any) => {
        const payoutAmount = Number(assign.payout_amount) || 0;
        const payoutType = assign.payout_type || 'monthly';
        const studentName = assign.profiles?.full_name || 'Unknown';

        // Assignment date range clamped to month
        const effectiveFrom = assign.effective_from_date || monthStart;
        const effectiveTo = assign.effective_to_date || monthEnd;
        const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
        const dateTo = effectiveTo < monthEnd ? effectiveTo : monthEnd;

        const fromDate = parseISO(dateFrom);
        const toDate = parseISO(dateTo);
        const totalDaysInRange = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Leave days (unpaid only create deductions)
        const teacherLeaves = leaveEvents.filter((l: any) => l.teacher_id === teacher.id);
        let unpaidLeaveDays = 0;
        const leaveDateSet = new Set<string>();
        teacherLeaves.forEach((leave: any) => {
          const lStart = parseISO(leave.start_date);
          const lEnd = parseISO(leave.end_date);
          const overlapStart = lStart > fromDate ? lStart : fromDate;
          const overlapEnd = lEnd < toDate ? lEnd : toDate;
          if (overlapStart <= overlapEnd) {
            const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
            days.forEach(d => {
              const key = format(d, 'yyyy-MM-dd');
              leaveDateSet.add(key);
              if (leave.leave_type === 'unpaid') unpaidLeaveDays++;
            });
          }
        });

        const eligibleDays = totalDaysInRange - unpaidLeaveDays;

        // Attendance per day for this student+teacher
        const studentAttendance = attendance.filter((a: any) => a.teacher_id === teacher.id && a.student_id === assign.student_id);
        const attendanceMap = new Map<string, string>();
        studentAttendance.forEach((a: any) => attendanceMap.set(a.class_date, a.status));

        // Build attendance day timeline
        const attendanceDays = allDatesInMonth
          .filter(d => d >= fromDate && d <= toDate)
          .map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const attStatus = attendanceMap.get(dateStr);
            let status = 'none'; // grey - no scheduled class
            if (attStatus === 'present' || attStatus === 'late') status = 'present';
            else if (attStatus === 'absent') status = 'absent';
            else if (attStatus === 'rescheduled') status = 'rescheduled';
            else if (leaveDateSet.has(dateStr)) status = 'leave';
            return { date: dateStr, status };
          });

        const presentCount = attendanceDays.filter(d => d.status === 'present').length;
        const absentCount = attendanceDays.filter(d => d.status === 'absent').length;
        const leaveCount = attendanceDays.filter(d => d.status === 'leave').length;
        const rescheduledCount = attendanceDays.filter(d => d.status === 'rescheduled').length;
        const missingCount = attendanceDays.filter(d => d.status === 'none').length;

        // Calculate amount
        let calculatedAmount = 0;
        if (payoutType === 'monthly') {
          calculatedAmount = (payoutAmount / daysInMonth) * eligibleDays;
        } else {
          calculatedAmount = payoutAmount * presentCount;
        }

        const studentFee = feeInvoices.find((f: any) => f.student_id === assign.student_id);

        return {
          studentId: assign.student_id,
          studentName,
          assignmentId: assign.id,
          dateFrom,
          dateTo,
          payoutRate: payoutAmount,
          payoutType,
          eligibleDays,
          totalDays: totalDaysInRange,
          calculatedAmount: Math.round(calculatedAmount * 100) / 100,
          editedAmount: editAmounts[assign.id] !== undefined ? editAmounts[assign.id] : null,
          attendanceDays,
          presentCount,
          absentCount,
          leaveCount,
          rescheduledCount,
          missingCount,
          feeStatus: studentFee?.status || 'no_invoice',
          lastPaymentDate: studentFee?.paid_at || null,
        };
      });

      const baseSalary = studentRows.reduce((sum, r) => sum + (r.editedAmount ?? r.calculatedAmount), 0);

      const teacherExtras = extraClasses.filter((e: any) => e.teacher_id === teacher.id);
      const extraClassAmount = teacherExtras.reduce((sum: number, e: any) => sum + Number(e.rate), 0);

      const teacherAdj = salaryAdjustments.filter((a: any) => a.teacher_id === teacher.id);
      const additions = teacherAdj.filter((a: any) => ['bonus', 'allowance', 'expense'].includes(a.adjustment_type)).reduce((s: number, a: any) => s + Number(a.amount), 0);
      const deductions = teacherAdj.filter((a: any) => a.adjustment_type === 'deduction').reduce((s: number, a: any) => s + Number(a.amount), 0);

      const netSalary = baseSalary + extraClassAmount + additions - deductions;
      const existingPayout = existingPayouts.find((p: any) => p.teacher_id === teacher.id);

      return {
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        students: studentRows,
        baseSalary: Math.round(baseSalary * 100) / 100,
        extraClassAmount: Math.round(extraClassAmount * 100) / 100,
        adjustmentAmount: Math.round(additions * 100) / 100,
        deductions: Math.round(deductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        payoutStatus: existingPayout?.status || 'draft',
      };
    }).filter(t => t.students.length > 0);
  }, [teachers, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments, existingPayouts, feeInvoices, salaryMonth, editAmounts, daysInMonth, allDatesInMonth, monthStart, monthEnd]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return salaryData;
    const q = searchQuery.toLowerCase();
    return salaryData.filter(t => t.teacherName.toLowerCase().includes(q));
  }, [salaryData, searchQuery]);

  const totalPayroll = salaryData.reduce((s, t) => s + t.netSalary, 0);
  const paidCount = salaryData.filter(t => t.payoutStatus === 'paid' || t.payoutStatus === 'locked').length;
  const draftCount = salaryData.filter(t => t.payoutStatus === 'draft').length;

  // ── Mutations ──

  const savePayout = useMutation({
    mutationFn: async (teacher: TeacherSalaryRow) => {
      const existing = existingPayouts.find((p: any) => p.teacher_id === teacher.teacherId);
      const payload = {
        teacher_id: teacher.teacherId,
        salary_month: salaryMonth,
        base_salary: teacher.baseSalary,
        extra_class_amount: teacher.extraClassAmount,
        adjustment_amount: teacher.adjustmentAmount,
        expense_amount: 0,
        gross_salary: teacher.baseSalary + teacher.extraClassAmount + teacher.adjustmentAmount,
        deductions: teacher.deductions,
        net_salary: teacher.netSalary,
        calculation_json: JSON.parse(JSON.stringify({ students: teacher.students, calculated_at: new Date().toISOString() })),
        status: 'confirmed',
      };
      if (existing) {
        if (existing.status === 'locked') throw new Error('Payout is locked');
        const { error } = await supabase.from('salary_payouts').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('salary_payouts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Salary saved & confirmed' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: async ({ teacherId, method, reference }: { teacherId: string; method: string; reference: string }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('Save payout first');
      const { error } = await supabase.from('salary_payouts').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user?.id,
        payment_method: method,
        payment_reference: reference,
      }).eq('id', payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Marked as paid' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
      setPayoutModalOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const lockPayout = useMutation({
    mutationFn: async (teacherId: string) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('Save payout first');
      const { error } = await supabase.from('salary_payouts').update({
        status: 'locked',
        locked_at: new Date().toISOString(),
        locked_by: user?.id,
      }).eq('id', payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payout locked' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addLeaveEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leave_events').insert({
        teacher_id: leaveForm.teacher_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason || null,
        status: 'approved',
        approved_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Leave event added' });
      queryClient.invalidateQueries({ queryKey: ['leave-events-salary'] });
      setLeaveModalOpen(false);
      setLeaveForm({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addExtraClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('extra_classes').insert({
        teacher_id: extraClassForm.teacher_id,
        student_id: extraClassForm.student_id || null,
        class_date: extraClassForm.class_date,
        duration_minutes: parseInt(extraClassForm.duration_minutes),
        rate: parseFloat(extraClassForm.rate) || 0,
        reason: extraClassForm.reason || null,
        status: 'approved',
        approved_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Extra class added' });
      queryClient.invalidateQueries({ queryKey: ['extra-classes-salary'] });
      setExtraClassModalOpen(false);
      setExtraClassForm({ teacher_id: '', student_id: '', class_date: '', duration_minutes: '30', rate: '', reason: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addAdjustment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('salary_adjustments').insert({
        teacher_id: adjForm.teacher_id,
        salary_month: salaryMonth,
        adjustment_type: adjForm.adjustment_type,
        amount: parseFloat(adjForm.amount) || 0,
        reason: adjForm.reason || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Adjustment added' });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
      setAdjustmentModalOpen(false);
      setAdjForm({ teacher_id: '', adjustment_type: 'bonus', amount: '', reason: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Helpers ──

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'locked': return <Badge className="bg-muted text-muted-foreground border-border gap-1"><Lock className="h-3 w-3" /> Locked</Badge>;
      case 'paid': return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'confirmed': return <Badge className="bg-accent/10 text-accent-foreground border-accent/20 gap-1"><Clock className="h-3 w-3" /> Confirmed</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Draft</Badge>;
    }
  };

  const getFeeStatusBadge = (status: string, lastPaid: string | null) => {
    const dateStr = lastPaid ? format(parseISO(lastPaid), 'dd MMM') : '';
    switch (status) {
      case 'paid': return <span className="text-xs text-primary">Paid {dateStr}</span>;
      case 'pending': return <span className="text-xs text-muted-foreground">Pending</span>;
      case 'overdue': return <span className="text-xs text-destructive">Overdue</span>;
      default: return <span className="text-xs text-muted-foreground">—</span>;
    }
  };

  const dotColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-primary';
      case 'absent': return 'bg-destructive';
      case 'leave': return 'bg-blue-500';
      case 'rescheduled': return 'bg-yellow-500';
      default: return 'bg-muted-foreground/30';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-accent" />
              Salary Engine
            </h1>
            <p className="text-sm text-muted-foreground">Assignment-based automated payroll</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLeaveModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Leave
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExtraClassModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Extra Class
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdjustmentModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adjustment
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Label className="text-xs">Salary Month</Label>
            <Select value={salaryMonth} onValueChange={setSalaryMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={`${now.getFullYear()}-${m.value}`}>{m.label} {now.getFullYear()}</SelectItem>
                ))}
                {MONTHS.map(m => (
                  <SelectItem key={`prev-${m.value}`} value={`${now.getFullYear() - 1}-${m.value}`}>{m.label} {now.getFullYear() - 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Teacher name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Payroll</p>
            <p className="text-lg font-bold">${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Teachers</p>
            <p className="text-lg font-bold">{salaryData.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-primary">{paidCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-accent">{draftCount}</p>
          </CardContent></Card>
        </div>

        {/* ── Summary Table ── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Additions</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No salary data for this month</TableCell></TableRow>
                )}
                {filteredData.map(teacher => (
                  <React.Fragment key={teacher.teacherId}>
                    {/* Summary Row */}
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedTeacher(expandedTeacher === teacher.teacherId ? null : teacher.teacherId)}
                    >
                      <TableCell>
                        {expandedTeacher === teacher.teacherId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{teacher.teacherName}</TableCell>
                      <TableCell className="text-right tabular-nums">${teacher.baseSalary.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">${teacher.extraClassAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-primary">${teacher.adjustmentAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">${teacher.deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">${teacher.netSalary.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(teacher.payoutStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => savePayout.mutate(teacher)} disabled={teacher.payoutStatus === 'locked'}>
                            Save
                          </Button>
                          {teacher.payoutStatus === 'confirmed' && (
                            <Button size="sm" onClick={() => { setSelectedTeacher(teacher); setPayoutModalOpen(true); }}>
                              Pay
                            </Button>
                          )}
                          {teacher.payoutStatus === 'paid' && (
                            <Button size="sm" variant="ghost" onClick={() => lockPayout.mutate(teacher.teacherId)}>
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded Salary Sheet ── */}
                    {expandedTeacher === teacher.teacherId && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/20 p-0">
                          <div className="p-4 space-y-4">
                            {/* Teacher Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-foreground">{teacher.teacherName}</p>
                                <p className="text-xs text-muted-foreground">Salary Sheet — {MONTHS[month - 1]?.label} {year}</p>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Present</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Absent</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Leave</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Rescheduled</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" /> Missing</span>
                              </div>
                            </div>

                            <Separator />

                            {/* Per-Student Rows */}
                            <div className="space-y-3">
                              {teacher.students.map(s => (
                                <div key={s.assignmentId} className="border border-border rounded-lg p-3 bg-background">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium text-sm">{s.studentName}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(parseISO(s.dateFrom), 'dd MMM')} – {format(parseISO(s.dateTo), 'dd MMM')}
                                      </span>
                                      <Badge variant="outline" className="text-xs capitalize">{s.payoutType.replace('_', '/')}</Badge>
                                      <span className="text-xs text-muted-foreground">${s.payoutRate}/mo</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground">{s.eligibleDays}/{s.totalDays} days</span>
                                      <span className="text-sm font-medium">${s.calculatedAmount.toFixed(2)}</span>
                                      <span className="text-xs text-muted-foreground">→</span>
                                      <Input
                                        type="number"
                                        className="h-7 w-24 text-right text-sm"
                                        value={editAmounts[s.assignmentId] !== undefined ? editAmounts[s.assignmentId] : s.calculatedAmount}
                                        onChange={e => setEditAmounts(prev => ({ ...prev, [s.assignmentId]: parseFloat(e.target.value) || 0 }))}
                                        disabled={teacher.payoutStatus === 'locked'}
                                      />
                                    </div>
                                  </div>

                                  {/* Attendance Timeline */}
                                  <TooltipProvider>
                                    <div className="flex items-center gap-0.5 flex-wrap mb-2">
                                      {s.attendanceDays.map(d => (
                                        <Tooltip key={d.date}>
                                          <TooltipTrigger asChild>
                                            <span className={`w-2.5 h-2.5 rounded-full ${dotColor(d.status)} inline-block cursor-default`} />
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            {format(parseISO(d.date), 'dd MMM')} — {d.status === 'none' ? 'No record' : d.status}
                                          </TooltipContent>
                                        </Tooltip>
                                      ))}
                                    </div>
                                  </TooltipProvider>

                                  {/* Stats Row */}
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="text-primary">{s.presentCount} present</span>
                                    <span className="text-destructive">{s.absentCount} absent</span>
                                    <span className="text-blue-500">{s.leaveCount} leave</span>
                                    <span className="text-yellow-600">{s.rescheduledCount} rescheduled</span>
                                    <Separator orientation="vertical" className="h-3" />
                                    {getFeeStatusBadge(s.feeStatus, s.lastPaymentDate)}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Adjustments summary */}
                            {(teacher.extraClassAmount > 0 || teacher.adjustmentAmount > 0 || teacher.deductions > 0) && (
                              <>
                                <Separator />
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {teacher.extraClassAmount > 0 && <span>Extra Classes: <strong className="text-primary">+${teacher.extraClassAmount.toFixed(2)}</strong></span>}
                                  {teacher.adjustmentAmount > 0 && <span>Additions: <strong className="text-primary">+${teacher.adjustmentAmount.toFixed(2)}</strong></span>}
                                  {teacher.deductions > 0 && <span>Deductions: <strong className="text-destructive">-${teacher.deductions.toFixed(2)}</strong></span>}
                                  <Separator orientation="vertical" className="h-5" />
                                  <span className="font-bold">Net: ${teacher.netSalary.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Leave Modal (NO replacement teacher) ── */}
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Leave Event</DialogTitle>
              <DialogDescription>Paid leave = no deduction. Unpaid = salary deduction. Replacement handled via assignment reassignment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={leaveForm.teacher_id} onValueChange={v => setLeaveForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leave Type</Label>
                <Select value={leaveForm.leave_type} onValueChange={v => setLeaveForm(p => ({ ...p, leave_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveModalOpen(false)}>Cancel</Button>
              <Button onClick={() => addLeaveEvent.mutate()} disabled={!leaveForm.teacher_id || !leaveForm.start_date || !leaveForm.end_date || addLeaveEvent.isPending}>
                {addLeaveEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Add Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Extra Class Modal (NO replacement teacher) ── */}
        <Dialog open={extraClassModalOpen} onOpenChange={setExtraClassModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Extra Class</DialogTitle>
              <DialogDescription>Additional class earning for teacher</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={extraClassForm.teacher_id} onValueChange={v => setExtraClassForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Student (optional)</Label>
                <Select value={extraClassForm.student_id} onValueChange={v => setExtraClassForm(p => ({ ...p, student_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {allStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={extraClassForm.class_date} onChange={e => setExtraClassForm(p => ({ ...p, class_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" value={extraClassForm.duration_minutes} onChange={e => setExtraClassForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Rate ($)</Label>
                <Input type="number" value={extraClassForm.rate} onChange={e => setExtraClassForm(p => ({ ...p, rate: e.target.value }))} />
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea value={extraClassForm.reason} onChange={e => setExtraClassForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtraClassModalOpen(false)}>Cancel</Button>
              <Button onClick={() => addExtraClass.mutate()} disabled={!extraClassForm.teacher_id || !extraClassForm.class_date || addExtraClass.isPending}>
                {addExtraClass.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Add Extra Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Manual Adjustment Modal ── */}
        <Dialog open={adjustmentModalOpen} onOpenChange={setAdjustmentModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Salary Adjustment</DialogTitle>
              <DialogDescription>Manual bonus, deduction, or allowance</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={adjForm.teacher_id} onValueChange={v => setAdjForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={adjForm.adjustment_type} onValueChange={v => setAdjForm(p => ({ ...p, adjustment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bonus (+)</SelectItem>
                    <SelectItem value="allowance">Allowance (+)</SelectItem>
                    <SelectItem value="deduction">Deduction (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustmentModalOpen(false)}>Cancel</Button>
              <Button onClick={() => addAdjustment.mutate()} disabled={!adjForm.teacher_id || !adjForm.amount || addAdjustment.isPending}>
                {addAdjustment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Add Adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Payment Modal ── */}
        <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Payment</DialogTitle>
              <DialogDescription>Mark salary as paid for {selectedTeacher?.teacherName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Net Salary</p>
                <p className="text-2xl font-bold">${selectedTeacher?.netSalary.toFixed(2)}</p>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {['Bank Transfer', 'JazzCash', 'EasyPaisa', 'Cash', 'Western Union', 'Other'].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference / Transaction ID</Label>
                <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="e.g. TXN-12345" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayoutModalOpen(false)}>Cancel</Button>
              <Button onClick={() => selectedTeacher && markPaid.mutate({ teacherId: selectedTeacher.teacherId, method: payMethod, reference: payRef })} disabled={markPaid.isPending}>
                {markPaid.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
