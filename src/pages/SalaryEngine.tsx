import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calculator, DollarSign, Users, Calendar, Lock, CheckCircle, Clock,
  Plus, Search, Loader2, AlertTriangle, ChevronDown, ChevronRight,
  Pencil, Eye, Ban, Undo2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isSameMonth } from 'date-fns';

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

interface TeacherSalaryRow {
  teacherId: string;
  teacherName: string;
  students: StudentPayoutRow[];
  baseSalary: number;
  extraClassAmount: number;
  adjustmentAmount: number;
  expenseAmount: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  payoutStatus: string;
}

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
  attendancePresent: number;
  attendanceAbsent: number;
  feeStatus: string;
}

export default function SalaryEngine() {
  const { activeBranch, activeDivision } = useDivision();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;

  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [extraClassModalOpen, setExtraClassModalOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherSalaryRow | null>(null);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '', replacement_teacher_id: '' });

  // Extra class form
  const [extraClassForm, setExtraClassForm] = useState({ teacher_id: '', student_id: '', class_date: '', duration_minutes: '30', rate: '', reason: '' });

  const [year, month] = salaryMonth.split('-').map(Number);
  const monthStart = `${salaryMonth}-01`;
  const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');

  // Fetch teachers
  const { data: teachers = [] } = useQuery({
    queryKey: ['salary-teachers'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
  });

  // Fetch assignment history for month
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

  // Fetch active assignments (fallback if no history)
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, payout_amount, payout_type, effective_from_date, status, profiles!student_teacher_assignments_student_id_fkey(full_name)')
        .in('status', ['active', 'paused', 'completed']);
      return data || [];
    },
  });

  // Fetch attendance for month
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

  // Fetch leave events
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

  // Fetch extra classes
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

  // Fetch salary adjustments
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

  // Fetch existing payouts
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

  // Fetch fee invoices for status display
  const { data: feeInvoices = [] } = useQuery({
    queryKey: ['fee-invoices-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('student_id, status')
        .eq('billing_month', salaryMonth);
      return data || [];
    },
  });

  // Fetch all students for dropdowns
  const { data: allStudents = [] } = useQuery({
    queryKey: ['all-students-salary'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
  });

  // Calculate salary data
  const salaryData: TeacherSalaryRow[] = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();

    return teachers.map(teacher => {
      // Get assignments for this teacher
      const teacherAssignments = assignments.filter((a: any) => a.teacher_id === teacher.id);

      // Build per-student rows
      const studentRows: StudentPayoutRow[] = teacherAssignments.map((assign: any) => {
        const payoutAmount = Number(assign.payout_amount) || 0;
        const payoutType = assign.payout_type || 'monthly';
        const studentName = assign.profiles?.full_name || 'Unknown';

        // Determine date range within month
        const effectiveFrom = assign.effective_from_date ? assign.effective_from_date : monthStart;
        const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
        const dateTo = monthEnd;

        // Calculate eligible days
        const fromDate = parseISO(dateFrom);
        const toDate = parseISO(dateTo);
        const totalDaysInRange = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Leave days for this teacher in range
        const teacherLeaves = leaveEvents.filter((l: any) => l.teacher_id === teacher.id && l.leave_type === 'unpaid');
        let unpaidLeaveDays = 0;
        teacherLeaves.forEach((leave: any) => {
          const lStart = parseISO(leave.start_date);
          const lEnd = parseISO(leave.end_date);
          const overlapStart = lStart > fromDate ? lStart : fromDate;
          const overlapEnd = lEnd < toDate ? lEnd : toDate;
          if (overlapStart <= overlapEnd) {
            unpaidLeaveDays += Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }
        });

        const eligibleDays = totalDaysInRange - unpaidLeaveDays;

        // Attendance for this student+teacher
        const studentAttendance = attendance.filter((a: any) => a.teacher_id === teacher.id && a.student_id === assign.student_id);
        const presentCount = studentAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
        const absentCount = studentAttendance.filter((a: any) => a.status === 'absent').length;

        // Calculate amount
        let calculatedAmount = 0;
        if (payoutType === 'monthly') {
          calculatedAmount = (payoutAmount / daysInMonth) * eligibleDays;
        } else {
          // per_class
          calculatedAmount = payoutAmount * presentCount;
        }

        // Fee status
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
          attendancePresent: presentCount,
          attendanceAbsent: absentCount,
          feeStatus: studentFee?.status || 'no_invoice',
        };
      });

      const baseSalary = studentRows.reduce((sum, r) => sum + (r.editedAmount ?? r.calculatedAmount), 0);

      // Extra classes
      const teacherExtras = extraClasses.filter((e: any) => e.teacher_id === teacher.id);
      const extraClassAmount = teacherExtras.reduce((sum: number, e: any) => sum + Number(e.rate), 0);

      // Adjustments
      const teacherAdj = salaryAdjustments.filter((a: any) => a.teacher_id === teacher.id);
      const bonuses = teacherAdj.filter((a: any) => a.adjustment_type === 'bonus' || a.adjustment_type === 'allowance').reduce((s: number, a: any) => s + Number(a.amount), 0);
      const deductions = teacherAdj.filter((a: any) => a.adjustment_type === 'deduction').reduce((s: number, a: any) => s + Number(a.amount), 0);
      const expenseAdj = teacherAdj.filter((a: any) => a.adjustment_type === 'expense').reduce((s: number, a: any) => s + Number(a.amount), 0);

      const grossSalary = baseSalary + extraClassAmount + bonuses + expenseAdj;
      const netSalary = grossSalary - deductions;

      const existingPayout = existingPayouts.find((p: any) => p.teacher_id === teacher.id);

      return {
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        students: studentRows,
        baseSalary: Math.round(baseSalary * 100) / 100,
        extraClassAmount: Math.round(extraClassAmount * 100) / 100,
        adjustmentAmount: Math.round((bonuses + expenseAdj) * 100) / 100,
        expenseAmount: Math.round(expenseAdj * 100) / 100,
        grossSalary: Math.round(grossSalary * 100) / 100,
        deductions: Math.round(deductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        payoutStatus: existingPayout?.status || 'draft',
      };
    }).filter(t => t.students.length > 0);
  }, [teachers, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments, existingPayouts, feeInvoices, salaryMonth, editAmounts, year, month]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return salaryData;
    const q = searchQuery.toLowerCase();
    return salaryData.filter(t => t.teacherName.toLowerCase().includes(q));
  }, [salaryData, searchQuery]);

  // Summary
  const totalPayroll = salaryData.reduce((s, t) => s + t.netSalary, 0);
  const paidCount = salaryData.filter(t => t.payoutStatus === 'paid' || t.payoutStatus === 'locked').length;
  const draftCount = salaryData.filter(t => t.payoutStatus === 'draft').length;

  // Mutations
  const savePayout = useMutation({
    mutationFn: async (teacher: TeacherSalaryRow) => {
      const existing = existingPayouts.find((p: any) => p.teacher_id === teacher.teacherId);
      const payload = {
        teacher_id: teacher.teacherId,
        salary_month: salaryMonth,
        base_salary: teacher.baseSalary,
        extra_class_amount: teacher.extraClassAmount,
        adjustment_amount: teacher.adjustmentAmount,
        expense_amount: teacher.expenseAmount,
        gross_salary: teacher.grossSalary,
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
      toast({ title: 'Payout saved' });
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
        replacement_teacher_id: leaveForm.replacement_teacher_id || null,
        status: 'approved',
        approved_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Leave event added' });
      queryClient.invalidateQueries({ queryKey: ['leave-events-salary'] });
      setLeaveModalOpen(false);
      setLeaveForm({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '', replacement_teacher_id: '' });
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

  // Payout modal state
  const [payMethod, setPayMethod] = useState('');
  const [payRef, setPayRef] = useState('');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'locked': return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><Lock className="h-3 w-3" /> Locked</Badge>;
      case 'paid': return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'confirmed': return <Badge className="bg-accent/10 text-accent-foreground border-accent/20 gap-1"><Clock className="h-3 w-3" /> Confirmed</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Draft</Badge>;
    }
  };

  const getFeeStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="outline" className="text-xs bg-accent/10 text-accent-foreground border-accent/20">Fee Paid</Badge>;
      case 'pending': return <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">Fee Pending</Badge>;
      case 'overdue': return <Badge variant="destructive" className="text-xs">Fee Overdue</Badge>;
      default: return <Badge variant="outline" className="text-xs">No Invoice</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-accent" />
              Salary Engine
            </h1>
            <p className="text-sm text-muted-foreground">Automated payroll with per-student breakdown</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLeaveModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Leave Event
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExtraClassModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Extra Class
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
            <Label className="text-xs">Search Teacher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Payroll</p>
              <p className="text-xl font-bold text-foreground">${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Teachers</p>
              <p className="text-xl font-bold text-foreground">{salaryData.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-xl font-bold text-primary">{paidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-accent">{draftCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Teacher Salary Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No salary data for this month
                    </TableCell>
                  </TableRow>
                )}
                {filteredData.map(teacher => (
                  <React.Fragment key={teacher.teacherId}>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedTeacher(expandedTeacher === teacher.teacherId ? null : teacher.teacherId)}>
                      <TableCell>
                        {expandedTeacher === teacher.teacherId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{teacher.teacherName}</TableCell>
                      <TableCell className="text-right">${teacher.baseSalary.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${teacher.extraClassAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${teacher.adjustmentAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-destructive">${teacher.deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">${teacher.netSalary.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(teacher.payoutStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); savePayout.mutate(teacher); }} disabled={teacher.payoutStatus === 'locked'}>
                            Save
                          </Button>
                          {teacher.payoutStatus === 'confirmed' && (
                            <Button size="sm" variant="outline" onClick={e => {
                              e.stopPropagation();
                              setSelectedTeacher(teacher);
                              setPayoutModalOpen(true);
                            }}>
                              Pay
                            </Button>
                          )}
                          {teacher.payoutStatus === 'paid' && (
                            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); lockPayout.mutate(teacher.teacherId); }}>
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedTeacher === teacher.teacherId && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30 p-0">
                          <div className="p-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Per-Student Breakdown</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Student</TableHead>
                                  <TableHead className="text-xs">From–To</TableHead>
                                  <TableHead className="text-xs">Type</TableHead>
                                  <TableHead className="text-xs text-right">Rate</TableHead>
                                  <TableHead className="text-xs text-right">Days</TableHead>
                                  <TableHead className="text-xs text-right">Present</TableHead>
                                  <TableHead className="text-xs text-right">Absent</TableHead>
                                  <TableHead className="text-xs text-right">Calculated</TableHead>
                                  <TableHead className="text-xs text-right">Final</TableHead>
                                  <TableHead className="text-xs">Fee Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {teacher.students.map(s => (
                                  <TableRow key={s.assignmentId}>
                                    <TableCell className="text-sm">{s.studentName}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {format(parseISO(s.dateFrom), 'dd MMM')} – {format(parseISO(s.dateTo), 'dd MMM')}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">{s.payoutType.replace('_', '/')}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">${s.payoutRate}</TableCell>
                                    <TableCell className="text-right text-sm">{s.eligibleDays}/{s.totalDays}</TableCell>
                                    <TableCell className="text-right text-sm text-primary">{s.attendancePresent}</TableCell>
                                    <TableCell className="text-right text-sm text-destructive">{s.attendanceAbsent}</TableCell>
                                    <TableCell className="text-right text-sm">${s.calculatedAmount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        className="h-7 w-24 text-right text-sm"
                                        value={editAmounts[s.assignmentId] !== undefined ? editAmounts[s.assignmentId] : s.calculatedAmount}
                                        onChange={e => setEditAmounts(prev => ({ ...prev, [s.assignmentId]: parseFloat(e.target.value) || 0 }))}
                                        disabled={teacher.payoutStatus === 'locked'}
                                      />
                                    </TableCell>
                                    <TableCell>{getFeeStatusBadge(s.feeStatus)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
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

        {/* Leave Event Modal */}
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Leave Event</DialogTitle>
              <DialogDescription>Record a teacher leave event</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={leaveForm.teacher_id} onValueChange={v => setLeaveForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
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
              <div>
                <Label>Replacement Teacher (optional)</Label>
                <Select value={leaveForm.replacement_teacher_id} onValueChange={v => setLeaveForm(p => ({ ...p, replacement_teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {teachers.filter(t => t.id !== leaveForm.teacher_id).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveModalOpen(false)}>Cancel</Button>
              <Button onClick={() => addLeaveEvent.mutate()} disabled={!leaveForm.teacher_id || !leaveForm.start_date || !leaveForm.end_date || addLeaveEvent.isPending}>
                {addLeaveEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extra Class Modal */}
        <Dialog open={extraClassModalOpen} onOpenChange={setExtraClassModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Extra Class</DialogTitle>
              <DialogDescription>Record additional class for earnings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select value={extraClassForm.teacher_id} onValueChange={v => setExtraClassForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Student (optional)</Label>
                <Select value={extraClassForm.student_id} onValueChange={v => setExtraClassForm(p => ({ ...p, student_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {allStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Class Date</Label>
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
                {addExtraClass.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add Extra Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payout Modal */}
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
                {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
