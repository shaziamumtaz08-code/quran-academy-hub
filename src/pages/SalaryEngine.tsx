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
  Calculator, Lock, CheckCircle, Clock, Plus, Search, Loader2, RotateCcw, AlertCircle, History, TrendingUp, TrendingDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';
import { SalarySheetDialog } from '@/components/salary/SalarySheetDialog';
import { BulkAdjustmentDialog } from '@/components/salary/BulkAdjustmentDialog';
import { AdjustmentHistoryDialog } from '@/components/salary/AdjustmentHistoryDialog';
import { trackActivity } from '@/lib/activityLogger';

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

export interface RoleSalaryRow {
  role: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo: string;
  activeDays: number;
  totalDays: number;
  proratedAmount: number;
  editedAmount: number | null;
  staffSalaryId: string;
}

interface TeacherSalaryRow {
  teacherId: string;
  teacherName: string;
  students: StudentPayoutRow[];
  roleSalaries: RoleSalaryRow[];
  baseSalary: number;
  extraClassAmount: number;
  adjustmentAmount: number;
  deductions: number;
  netSalary: number;
  payoutStatus: string;
  payoutId?: string | null;
  staffType: 'teacher' | 'staff' | 'dual';
}

const REVERT_REASONS = [
  'Incorrect amount',
  'Wrong month',
  'Duplicate entry',
  'Payment not completed',
  'Other',
];

type StaffFilter = 'all' | 'teachers' | 'staff';

export default function SalaryEngine() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const isTeacherView = activeRole === 'teacher';
  const queryClient = useQueryClient();

  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});
  const [editRoleAmounts, setEditRoleAmounts] = useState<Record<string, number>>({});
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkDeductOpen, setBulkDeductOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // Revert modal state
  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [revertTeacherId, setRevertTeacherId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [revertOtherText, setRevertOtherText] = useState('');

  // Forms
  const [leaveForm, setLeaveForm] = useState({ teacher_id: '', leave_type: 'unpaid', start_date: '', end_date: '', reason: '' });
  const [adjForm, setAdjForm] = useState({ teacher_id: '', adjustment_type: 'bonus', amount: '', reason: '', mode: 'flat' as 'flat' | 'percentage' });

  const [year, month] = salaryMonth.split('-').map(Number);
  const monthStart = `${salaryMonth}-01`;
  const fullMonthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
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

  // Query staff_salaries for the month
  const { data: staffSalaries = [] } = useQuery({
    queryKey: ['staff-salaries', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_salaries')
        .select('*')
        .lte('effective_from', fullMonthEnd)
        .or(`effective_to.is.null,effective_to.gte.${monthStart}`);
      return data || [];
    },
  });

  // Query profiles for staff salary users (non-teachers who have staff_salaries)
  const staffUserIds = useMemo(() => {
    const teacherIds = new Set(teachers.map((t: any) => t.id));
    return [...new Set(staffSalaries.map((s: any) => s.user_id).filter((id: string) => !teacherIds.has(id)))];
  }, [staffSalaries, teachers]);

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['salary-staff-profiles', staffUserIds],
    queryFn: async () => {
      if (!staffUserIds.length) return [];
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, whatsapp_number, country, city, bank_name, bank_account_title, bank_account_number, bank_iban')
        .in('id', staffUserIds)
        .is('archived_at', null)
        .order('full_name');
      return data || [];
    },
    enabled: staffUserIds.length > 0,
  });

  // Combined profiles: teachers + staff-only profiles
  const allSalariedProfiles = useMemo(() => {
    const profileMap = new Map<string, any>();
    teachers.forEach((t: any) => profileMap.set(t.id, t));
    staffProfiles.forEach((s: any) => { if (!profileMap.has(s.id)) profileMap.set(s.id, s); });
    return Array.from(profileMap.values());
  }, [teachers, staffProfiles]);

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, payout_amount, payout_type, effective_from_date, effective_to_date, status, profiles!student_teacher_assignments_student_id_fkey(full_name)')
        .in('status', ['active', 'completed']);
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

  // ── Role Salary Calculation Helper ──

  const calculateRoleSalaries = (userId: string): RoleSalaryRow[] => {
    const userStaffSalaries = staffSalaries.filter((s: any) => s.user_id === userId);
    return userStaffSalaries.map((ss: any) => {
      const effFrom = ss.effective_from;
      const effTo = ss.effective_to || fullMonthEnd;
      const dateFrom = effFrom > monthStart ? effFrom : monthStart;
      const dateTo = effTo < fullMonthEnd ? effTo : fullMonthEnd;

      if (dateFrom > dateTo) return null;

      const fromDate = parseISO(dateFrom);
      const toDate = parseISO(dateTo);
      const activeDays = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      let proratedAmount = ss.monthly_amount;
      if (ss.prorate_partial_months && activeDays < daysInMonth) {
        proratedAmount = (ss.monthly_amount / daysInMonth) * activeDays;
      }

      return {
        role: ss.role,
        monthlyAmount: Number(ss.monthly_amount),
        effectiveFrom: dateFrom,
        effectiveTo: dateTo,
        activeDays,
        totalDays: daysInMonth,
        proratedAmount: Math.round(proratedAmount * 100) / 100,
        editedAmount: editRoleAmounts[ss.id] !== undefined ? editRoleAmounts[ss.id] : null,
        staffSalaryId: ss.id,
      } as RoleSalaryRow;
    }).filter((r): r is RoleSalaryRow => r !== null);
  };

  // ── Calculation Engine ──

  const salaryData: TeacherSalaryRow[] = useMemo(() => {
    return allSalariedProfiles.map((profile: any) => {
      const teacherAssignments = assignments.filter((a: any) => a.teacher_id === profile.id);

      const studentRows: StudentPayoutRow[] = teacherAssignments.map((assign: any) => {
        const payoutAmount = Number(assign.payout_amount) || 0;
        const payoutType = assign.payout_type || 'monthly';
        const studentName = assign.profiles?.full_name || 'Unknown';

        const effectiveFrom = assign.effective_from_date || monthStart;
        const effectiveTo = assign.effective_to_date || monthEnd;
        const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
        const dateTo = effectiveTo < monthEnd ? effectiveTo : monthEnd;

        if (dateFrom > dateTo) return null;

        const fromDate = parseISO(dateFrom);
        const toDate = parseISO(dateTo);
        const totalDaysInRange = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const teacherLeaves = leaveEvents.filter((l: any) => l.teacher_id === profile.id);
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

        const studentAttendance = attendance.filter((a: any) => a.teacher_id === profile.id && a.student_id === assign.student_id);
        const attendanceMap = new Map<string, string>();
        studentAttendance.forEach((a: any) => attendanceMap.set(a.class_date, a.status));

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
      }).filter((row): row is StudentPayoutRow => row !== null);

      // Role-based salaries
      const roleSalaries = calculateRoleSalaries(profile.id);

      const hasStudents = studentRows.length > 0;
      const hasRoleSalaries = roleSalaries.length > 0;

      // Skip users with neither students nor role salaries
      if (!hasStudents && !hasRoleSalaries) return null;

      const teachingBase = studentRows.reduce((sum, r) => sum + (r.editedAmount ?? r.calculatedAmount), 0);
      const roleBase = roleSalaries.reduce((sum, r) => sum + (r.editedAmount ?? r.proratedAmount), 0);
      const baseSalary = teachingBase + roleBase;
      
      const teacherExtras = extraClasses.filter((e: any) => e.teacher_id === profile.id);
      const extraClassAmount = teacherExtras.reduce((sum: number, e: any) => sum + Number(e.rate), 0);
      const teacherAdj = salaryAdjustments.filter((a: any) => a.teacher_id === profile.id);
      const additions = teacherAdj.filter((a: any) => ['bonus', 'allowance', 'expense'].includes(a.adjustment_type)).reduce((s: number, a: any) => s + Number(a.amount), 0);
      const deductions = teacherAdj.filter((a: any) => a.adjustment_type === 'deduction').reduce((s: number, a: any) => s + Number(a.amount), 0);
      const netSalary = baseSalary + extraClassAmount + additions - deductions;
      const existingPayout = existingPayouts.find((p: any) => p.teacher_id === profile.id);

      const staffType = hasStudents && hasRoleSalaries ? 'dual' : hasStudents ? 'teacher' : 'staff';

      return {
        teacherId: profile.id,
        teacherName: profile.full_name,
        students: studentRows,
        roleSalaries,
        baseSalary: Math.round(baseSalary * 100) / 100,
        extraClassAmount: Math.round(extraClassAmount * 100) / 100,
        adjustmentAmount: Math.round(additions * 100) / 100,
        deductions: Math.round(deductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        payoutStatus: existingPayout?.status || 'draft',
        staffType,
      };
    }).filter((t): t is TeacherSalaryRow => t !== null);
  }, [allSalariedProfiles, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments, existingPayouts, feeInvoices, schedules, staffSalaries, salaryMonth, editAmounts, editRoleAmounts, daysInMonth, allDatesInMonth, monthStart, monthEnd, fullMonthEnd]);

  const filteredData = useMemo(() => {
    let data = salaryData;
    if (isTeacherView && user?.id) {
      data = data.filter(t => t.teacherId === user.id);
    }
    // Apply staff filter
    if (staffFilter === 'teachers') {
      data = data.filter(t => t.staffType === 'teacher' || t.staffType === 'dual');
    } else if (staffFilter === 'staff') {
      data = data.filter(t => t.staffType === 'staff' || t.staffType === 'dual');
    }
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(t => t.teacherName.toLowerCase().includes(q));
  }, [salaryData, searchQuery, isTeacherView, user?.id, staffFilter]);

  const totalPayroll = salaryData.reduce((s, t) => s + t.netSalary, 0);
  const paidCount = salaryData.filter(t => t.payoutStatus === 'paid' || t.payoutStatus === 'locked' || t.payoutStatus === 'partially_paid').length;
  const partialCount = salaryData.filter(t => t.payoutStatus === 'partially_paid').length;
  const draftCount = salaryData.filter(t => t.payoutStatus === 'draft' || t.payoutStatus === 'confirmed').length;

  const selectedTeacher = salaryData.find(t => t.teacherId === selectedTeacherId) || null;
  const selectedProfile = allSalariedProfiles.find((t: any) => t.id === selectedTeacherId) || null;

  const teacherAttendance = useMemo(() => {
    if (!selectedTeacherId) return { present: 0, absent: 0, leave: 0, notMarked: 0 };
    const teacherAtt = attendance.filter((a: any) => a.teacher_id === selectedTeacherId);
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
        calculation_json: JSON.parse(JSON.stringify({
          students: teacher.students,
          roleSalaries: teacher.roleSalaries,
          staffType: teacher.staffType,
          calculated_at: new Date().toISOString(),
        })),
        status: 'confirmed',
      };
      if (existing) {
        if (existing.status === 'locked' || existing.status === 'paid') throw new Error('Payout is ' + existing.status + ', cannot edit calculations');
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
    mutationFn: async ({ teacherId, type, reason, invoiceNumber, receiptUrls, amountPaid }: { teacherId: string; type: 'full' | 'partial'; reason?: string; invoiceNumber?: string; receiptUrls?: string[]; amountPaid?: number }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) {
        const teacher = salaryData.find(t => t.teacherId === teacherId);
        if (teacher) await savePayout.mutateAsync(teacher);
      }
      const payoutRefresh = (await supabase.from('salary_payouts').select('id, net_salary').eq('teacher_id', teacherId).eq('salary_month', salaryMonth).single()).data;
      if (!payoutRefresh) throw new Error('Save payout first');

      const netSalary = Number(payoutRefresh.net_salary) || 0;

      if (type === 'partial') {
        const paidAmount = amountPaid || 0;
        const finalStatus = paidAmount >= netSalary ? 'paid' : 'partially_paid';
        const { error } = await supabase.from('salary_payouts').update({
          status: finalStatus,
          amount_paid: paidAmount,
          partial_notes: reason || null,
          paid_at: finalStatus === 'paid' ? new Date().toISOString() : null,
          paid_by: finalStatus === 'paid' ? user?.id : null,
          payment_method: 'Partial Payment',
          invoice_number: invoiceNumber || null,
          receipt_urls: receiptUrls || [],
          receipt_url: receiptUrls?.[0] || null,
        }).eq('id', payoutRefresh.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('salary_payouts').update({
          status: 'paid',
          amount_paid: netSalary,
          paid_at: new Date().toISOString(),
          paid_by: user?.id,
          payment_method: 'Full Payment',
          invoice_number: invoiceNumber || null,
          receipt_urls: receiptUrls || [],
          receipt_url: receiptUrls?.[0] || null,
        }).eq('id', payoutRefresh.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const topUpPayment = useMutation({
    mutationFn: async ({ teacherId, amount, notes, receiptUrls }: { teacherId: string; amount: number; notes: string; receiptUrls?: string[] }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('No payout record found');
      const currentPaid = Number(payout.amount_paid) || 0;
      const netSalary = Number(payout.net_salary) || 0;
      const newTotal = currentPaid + amount;
      const finalStatus = newTotal >= netSalary ? 'paid' : 'partially_paid';
      const existingNotes = payout.partial_notes || '';
      const combinedNotes = existingNotes ? `${existingNotes}\n---\nTop-up: ${notes}` : `Top-up: ${notes}`;
      
      const existingReceipts = payout.receipt_urls || [];
      const mergedReceipts = [...existingReceipts, ...(receiptUrls || [])].slice(0, 3);

      const { error } = await supabase.from('salary_payouts').update({
        status: finalStatus,
        amount_paid: newTotal,
        partial_notes: combinedNotes,
        ...(finalStatus === 'paid' ? { paid_at: new Date().toISOString(), paid_by: user?.id } : {}),
        receipt_urls: mergedReceipts,
        receipt_url: mergedReceipts[0] || null,
      }).eq('id', payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Top-up payment recorded' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateProofs = useMutation({
    mutationFn: async ({ teacherId, receiptUrls, invoiceNumber }: { teacherId: string; receiptUrls: string[]; invoiceNumber?: string }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('No payout record found');
      if (payout.status === 'locked') throw new Error('Payout is locked');
      const { error } = await supabase.from('salary_payouts').update({
        receipt_urls: receiptUrls,
        receipt_url: receiptUrls[0] || null,
        ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
      }).eq('id', payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payment proofs updated' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const lockPayout = useMutation({
    mutationFn: async (teacherId: string) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('Save payout first');
      if (payout.status !== 'paid') throw new Error('Can only lock paid payouts');
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

  const revertToDraft = useMutation({
    mutationFn: async ({ teacherId, reason }: { teacherId: string; reason: string }) => {
      const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
      if (!payout) throw new Error('No payout to revert');
      const { error } = await supabase.from('salary_payouts').update({
        status: 'draft',
        paid_at: null,
        paid_by: null,
        locked_at: null,
        locked_by: null,
        amount_paid: 0,
        partial_notes: null,
        reverted_at: new Date().toISOString(),
        reverted_by: user?.id,
        revert_reason: reason,
      }).eq('id', payout.id);
      if (error) throw error;
      
      await trackActivity({
        action: 'payment_edited',
        entityType: 'payment_transaction',
        entityId: payout.id,
        details: {
          action: 'revert_to_draft',
          teacher_id: teacherId,
          previous_status: payout.status,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Reverted to draft' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
      setRevertModalOpen(false);
      setRevertTeacherId(null);
      setRevertReason('');
      setRevertOtherText('');
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

  const getStatusBadge = (status: string, payout?: any) => {
    switch (status) {
      case 'locked': return <Badge className="bg-muted text-muted-foreground border-border gap-1"><Lock className="h-3 w-3" /> Locked</Badge>;
      case 'paid': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'partially_paid': {
        const paid = Number(payout?.amount_paid) || 0;
        const net = Number(payout?.net_salary) || 0;
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="h-3 w-3" /> Partial
            {net > 0 && <span className="text-[10px] ml-1">{Math.round((paid/net)*100)}%</span>}
          </Badge>
        );
      }
      case 'confirmed': return <Badge className="bg-sky-50 text-sky-700 border-sky-200 gap-1"><Clock className="h-3 w-3" /> Confirmed</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Draft</Badge>;
    }
  };

  const getStaffTypeBadge = (staffType: string) => {
    switch (staffType) {
      case 'staff': return <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Staff</Badge>;
      case 'dual': return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Dual Role</Badge>;
      default: return null;
    }
  };

  const handleRevertClick = (teacherId: string) => {
    setRevertTeacherId(teacherId);
    setRevertReason('');
    setRevertOtherText('');
    setRevertModalOpen(true);
  };

  const confirmRevert = () => {
    if (!revertTeacherId) return;
    const finalReason = revertReason === 'Other' ? revertOtherText : revertReason;
    if (!finalReason.trim()) {
      toast({ title: 'Please select a reason', variant: 'destructive' });
      return;
    }
    revertToDraft.mutate({ teacherId: revertTeacherId, reason: finalReason });
  };

  const selectedPayout = existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId);

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
            <div className="w-40">
              <Label className="text-xs">Type</Label>
              <Select value={staffFilter} onValueChange={(v) => setStaffFilter(v as StaffFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="teachers">Teachers</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
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
              <p className="text-lg font-bold">PKR {totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Staff</p>
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
                  <TableHead>Name</TableHead>
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
                {filteredData.map(teacher => {
                  const payout = existingPayouts.find((p: any) => p.teacher_id === teacher.teacherId);
                  const canRevert = payout && (payout.status === 'confirmed' || payout.status === 'paid' || payout.status === 'locked' || payout.status === 'partially_paid');
                  const canSave = teacher.payoutStatus !== 'locked' && teacher.payoutStatus !== 'paid' && teacher.payoutStatus !== 'partially_paid';
                  
                  return (
                    <TableRow key={teacher.teacherId} className="group">
                      <TableCell>
                        <button
                          className="font-medium text-foreground hover:text-accent underline-offset-2 hover:underline transition-colors text-left"
                          onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}
                        >
                          {teacher.teacherName}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {teacher.staffType === 'staff' ? (
                            <p className="text-xs text-muted-foreground">
                              {teacher.roleSalaries.map(r => r.role).join(', ')}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">{teacher.students.length} student{teacher.students.length !== 1 ? 's' : ''}</p>
                          )}
                          {getStaffTypeBadge(teacher.staffType)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">PKR {teacher.baseSalary.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">PKR {teacher.extraClassAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">PKR {teacher.adjustmentAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">PKR {teacher.deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">PKR {teacher.netSalary.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(teacher.payoutStatus, payout)}</TableCell>
                      {!isTeacherView && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}>
                              View Sheet
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => savePayout.mutate(teacher)} 
                              disabled={!canSave || savePayout.isPending}
                            >
                              {savePayout.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                              Save
                            </Button>
                            {teacher.payoutStatus === 'paid' && (
                              <Button size="sm" variant="ghost" onClick={() => lockPayout.mutate(teacher.teacherId)}>
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {canRevert && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleRevertClick(teacher.teacherId)}
                              >
                                <RotateCcw className="h-4 w-4" />
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
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Salary Sheet Dialog ── */}
        <SalarySheetDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          teacher={selectedTeacher ? { ...selectedTeacher, payoutId: (existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId)?.id || null) } as any : null}
          teacherProfile={selectedProfile}
          teacherAttendance={teacherAttendance}
          adjustments={selectedAdjustments}
          salaryMonth={salaryMonth}
          year={year}
          month={month}
          editAmounts={editAmounts}
          editRoleAmounts={editRoleAmounts}
          onEditAmount={(id, amt) => setEditAmounts(prev => ({ ...prev, [id]: amt }))}
          onEditRoleAmount={(id, amt) => setEditRoleAmounts(prev => ({ ...prev, [id]: amt }))}
          onMarkPaid={(type, reason, invoiceNumber, receiptUrls, amountPaid) => {
            if (selectedTeacherId) {
              markPaid.mutate({ teacherId: selectedTeacherId, type, reason, invoiceNumber, receiptUrls, amountPaid });
            }
          }}
          onTopUp={(amount, notes, receiptUrls) => {
            if (selectedTeacherId) {
              topUpPayment.mutate({ teacherId: selectedTeacherId, amount, notes, receiptUrls });
            }
          }}
          onUpdateProofs={(receiptUrls, invoiceNumber) => {
            if (selectedTeacherId) {
              updateProofs.mutate({ teacherId: selectedTeacherId, receiptUrls, invoiceNumber });
            }
          }}
          onRevert={() => {
            if (selectedTeacherId) {
              handleRevertClick(selectedTeacherId);
            }
          }}
          isPayingPending={markPaid.isPending}
          isTopUpPending={topUpPayment.isPending}
          isUpdatingProofs={updateProofs.isPending}
          isLocked={selectedTeacher?.payoutStatus === 'locked'}
          isPaid={selectedTeacher?.payoutStatus === 'paid'}
          isPartiallyPaid={selectedTeacher?.payoutStatus === 'partially_paid'}
          existingAmountPaid={Number(selectedPayout?.amount_paid) || 0}
          viewerRole={isTeacherView ? 'teacher' : 'admin'}
          existingReceiptUrls={selectedPayout?.receipt_urls || []}
          existingInvoiceNumber={selectedPayout?.invoice_number || null}
        />

        {/* ── Revert Confirmation Modal ── */}
        <Dialog open={revertModalOpen} onOpenChange={setRevertModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <RotateCcw className="h-5 w-5" />
                Revert to Draft
              </DialogTitle>
              <DialogDescription>
                This will reset the salary record back to draft status, clearing payment info. A reason is required for audit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason for Revert</Label>
                <Select value={revertReason} onValueChange={setRevertReason}>
                  <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {REVERT_REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {revertReason === 'Other' && (
                <div>
                  <Label>Please specify</Label>
                  <Textarea 
                    value={revertOtherText} 
                    onChange={e => setRevertOtherText(e.target.value)}
                    placeholder="Enter reason..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevertModalOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive"
                onClick={confirmRevert}
                disabled={!revertReason || (revertReason === 'Other' && !revertOtherText.trim()) || revertToDraft.isPending}
              >
                {revertToDraft.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Revert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Leave Modal ── */}
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Leave Event</DialogTitle>
              <DialogDescription>Paid leave = no deduction. Unpaid = salary deduction.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <Select value={leaveForm.teacher_id} onValueChange={v => setLeaveForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{allSalariedProfiles.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
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
                <Label>Staff Member</Label>
                <Select value={adjForm.teacher_id} onValueChange={v => setAdjForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{allSalariedProfiles.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
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
