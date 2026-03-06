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
import {
  Calculator, Lock, CheckCircle, Clock, Plus, Search, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';
import { SalarySheetDialog } from '@/components/salary/SalarySheetDialog';

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
  holidayCount: number;
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
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const isTeacherView = activeRole === 'teacher';
  const queryClient = useQueryClient();

  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Forms
  const [leaveForm, setLeaveForm] = useState({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '' });
  const [adjForm, setAdjForm] = useState({ teacher_id: '', adjustment_type: 'bonus', amount: '', reason: '' });

  const [year, month] = salaryMonth.split('-').map(Number);
  const monthStart = `${salaryMonth}-01`;
  const fullMonthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  // For current/future months, cap at yesterday so we don't count future "not marked" days
  const monthEnd = today < fullMonthEnd ? today : fullMonthEnd;
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDatesInMonth = eachDayOfInterval({ start: parseISO(monthStart), end: parseISO(monthEnd) });

  // ── Data Queries ──

  const { data: teachers = [] } = useQuery({
    queryKey: ['salary-teachers'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, email, whatsapp_number, country, city, bank_name, bank_account_title, bank_account_number, bank_iban').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
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

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedules')
        .select('assignment_id, day_of_week')
        .eq('is_active', true);
      return data || [];
    },
  });

  // ── Calculation Engine ──

  const salaryData: TeacherSalaryRow[] = useMemo(() => {
    return teachers.map((teacher: any) => {
      const teacherAssignments = assignments.filter((a: any) => a.teacher_id === teacher.id);

      const studentRows: StudentPayoutRow[] = teacherAssignments.map((assign: any) => {
        const payoutAmount = Number(assign.payout_amount) || 0;
        const payoutType = assign.payout_type || 'monthly';
        const studentName = assign.profiles?.full_name || 'Unknown';

        const effectiveFrom = assign.effective_from_date || monthStart;
        const effectiveTo = assign.effective_to_date || monthEnd;
        const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
        const dateTo = effectiveTo < monthEnd ? effectiveTo : monthEnd;

        const fromDate = parseISO(dateFrom);
        const toDate = parseISO(dateTo);
        const totalDaysInRange = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

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

        const studentAttendance = attendance.filter((a: any) => a.teacher_id === teacher.id && a.student_id === assign.student_id);
        const attendanceMap = new Map<string, string>();
        studentAttendance.forEach((a: any) => attendanceMap.set(a.class_date, a.status));

        // Determine scheduled days of week for this assignment
        const assignSchedules = schedules.filter((s: any) => s.assignment_id === assign.id);
        const scheduledDays = new Set(assignSchedules.map((s: any) => s.day_of_week?.toLowerCase()));

        const attendanceDays = allDatesInMonth
          .filter(d => d >= fromDate && d <= toDate)
          .map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const attStatus = attendanceMap.get(dateStr);
            const dayName = format(d, 'EEEE').toLowerCase();
            let status = 'none';
            if (attStatus === 'present' || attStatus === 'late') status = 'present';
            else if (attStatus === 'absent') status = 'absent';
            else if (attStatus === 'rescheduled') status = 'rescheduled';
            else if (leaveDateSet.has(dateStr)) status = 'leave';
            else if (scheduledDays.size > 0 && !scheduledDays.has(dayName)) status = 'holiday';
            // else remains 'none' (not marked on a scheduled day)
            return { date: dateStr, status };
          });

        const presentCount = attendanceDays.filter(d => d.status === 'present').length;
        const absentCount = attendanceDays.filter(d => d.status === 'absent').length;
        const leaveCount = attendanceDays.filter(d => d.status === 'leave').length;
        const rescheduledCount = attendanceDays.filter(d => d.status === 'rescheduled').length;
        const holidayCount = attendanceDays.filter(d => d.status === 'holiday').length;
        const missingCount = attendanceDays.filter(d => d.status === 'none').length;

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
          holidayCount,
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
  }, [teachers, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments, existingPayouts, feeInvoices, schedules, salaryMonth, editAmounts, daysInMonth, allDatesInMonth, monthStart, monthEnd]);

  const filteredData = useMemo(() => {
    let data = salaryData;
    // Teachers only see their own salary
    if (isTeacherView && user?.id) {
      data = data.filter(t => t.teacherId === user.id);
    }
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(t => t.teacherName.toLowerCase().includes(q));
  }, [salaryData, searchQuery, isTeacherView, user?.id]);

  const totalPayroll = salaryData.reduce((s, t) => s + t.netSalary, 0);
  const paidCount = salaryData.filter(t => t.payoutStatus === 'paid' || t.payoutStatus === 'locked').length;
  const draftCount = salaryData.filter(t => t.payoutStatus === 'draft').length;

  // Selected teacher for sheet
  const selectedTeacher = salaryData.find(t => t.teacherId === selectedTeacherId) || null;
  const selectedProfile = teachers.find((t: any) => t.id === selectedTeacherId) || null;

  // Teacher's own attendance snapshot
  const teacherAttendance = useMemo(() => {
    if (!selectedTeacherId) return { present: 0, absent: 0, leave: 0, notMarked: 0 };
    const teacherAtt = attendance.filter((a: any) => a.teacher_id === selectedTeacherId);
    const uniqueDates = new Set(teacherAtt.map((a: any) => a.class_date));
    const presentDates = new Set(teacherAtt.filter((a: any) => a.status === 'present' || a.status === 'late').map((a: any) => a.class_date));
    const absentDates = new Set(teacherAtt.filter((a: any) => a.status === 'absent').map((a: any) => a.class_date));
    const leaveDates = leaveEvents.filter((l: any) => l.teacher_id === selectedTeacherId).length;
    return {
      present: presentDates.size,
      absent: absentDates.size,
      leave: leaveDates,
      notMarked: Math.max(0, daysInMonth - presentDates.size - absentDates.size - leaveDates),
    };
  }, [selectedTeacherId, attendance, leaveEvents, daysInMonth]);

  // Teacher adjustments for sheet
  const selectedAdjustments = useMemo(() => {
    if (!selectedTeacherId) return [];
    return salaryAdjustments.filter((a: any) => a.teacher_id === selectedTeacherId);
  }, [selectedTeacherId, salaryAdjustments]);

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
    mutationFn: async ({ teacherId, type, reason, invoiceNumber, receiptUrl }: { teacherId: string; type: 'full' | 'partial'; reason?: string; invoiceNumber?: string; receiptUrl?: string }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) {
        // Auto-save first
        const teacher = salaryData.find(t => t.teacherId === teacherId);
        if (teacher) await savePayout.mutateAsync(teacher);
      }
      const payoutRefresh = (await supabase.from('salary_payouts').select('id').eq('teacher_id', teacherId).eq('salary_month', salaryMonth).single()).data;
      if (!payoutRefresh) throw new Error('Save payout first');
      const { error } = await supabase.from('salary_payouts').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user?.id,
        payment_method: type === 'partial' ? `Partial: ${reason}` : 'Full Payment',
        invoice_number: invoiceNumber || null,
        receipt_url: receiptUrl || null,
      }).eq('id', payoutRefresh.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
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
      case 'paid': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'confirmed': return <Badge className="bg-sky-50 text-sky-700 border-sky-200 gap-1"><Clock className="h-3 w-3" /> Confirmed</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Draft</Badge>;
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
          {!isTeacherView && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setLeaveModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Leave
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdjustmentModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adjustment
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        {!isTeacherView && (
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
        )}
        {isTeacherView && (
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
          </div>
        )}



        {!isTeacherView && (
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
              <p className="text-lg font-bold text-emerald-600">{paidCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-amber-600">{draftCount}</p>
            </CardContent></Card>
          </div>
        )}

        {/* ── Summary Table ── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Additions</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Net</TableHead>
                  <TableHead>Status</TableHead>
                  {!isTeacherView && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 && (
                  <TableRow><TableCell colSpan={isTeacherView ? 7 : 8} className="text-center py-12 text-muted-foreground">No salary data for this month</TableCell></TableRow>
                )}
                {filteredData.map(teacher => (
                  <TableRow key={teacher.teacherId} className="group">
                    <TableCell>
                      <button
                        className="font-medium text-foreground hover:text-accent underline-offset-2 hover:underline transition-colors text-left"
                        onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}
                      >
                        {teacher.teacherName}
                      </button>
                      <p className="text-xs text-muted-foreground">{teacher.students.length} student{teacher.students.length !== 1 ? 's' : ''}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">${teacher.baseSalary.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${teacher.extraClassAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">${teacher.adjustmentAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">${teacher.deductions.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">${teacher.netSalary.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(teacher.payoutStatus)}</TableCell>
                    {!isTeacherView && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}>
                            View Sheet
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => savePayout.mutate(teacher)} disabled={teacher.payoutStatus === 'locked'}>
                            Save
                          </Button>
                          {teacher.payoutStatus === 'paid' && (
                            <Button size="sm" variant="ghost" onClick={() => lockPayout.mutate(teacher.teacherId)}>
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isTeacherView && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}>
                          View Sheet
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Salary Sheet Dialog ── */}
        <SalarySheetDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          teacher={selectedTeacher}
          teacherProfile={selectedProfile}
          teacherAttendance={teacherAttendance}
          adjustments={selectedAdjustments}
          salaryMonth={salaryMonth}
          year={year}
          month={month}
          editAmounts={editAmounts}
          onEditAmount={(id, amt) => setEditAmounts(prev => ({ ...prev, [id]: amt }))}
          onMarkPaid={(type, reason, invoiceNumber, receiptUrl) => {
            if (selectedTeacherId) {
              markPaid.mutate({ teacherId: selectedTeacherId, type, reason, invoiceNumber, receiptUrl });
            }
          }}
          isPayingPending={markPaid.isPending}
          isLocked={selectedTeacher?.payoutStatus === 'locked'}
          viewerRole={isTeacherView ? 'teacher' : 'admin'}
          existingReceiptUrl={existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId)?.receipt_url || null}
          existingInvoiceNumber={existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId)?.invoice_number || null}
        />

        {/* ── Leave Modal ── */}
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Leave Event</DialogTitle>
              <DialogDescription>Paid leave = no deduction. Unpaid = salary deduction.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={leaveForm.teacher_id} onValueChange={v => setLeaveForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
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

        {/* ── Adjustment Modal ── */}
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
                  <SelectContent>{teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
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
      </div>
    </DashboardLayout>
  );
}
