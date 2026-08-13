import React, { useState, useMemo } from 'react';
import { assignmentMonthWindow, SALARY_ASSIGNMENT_STATUSES } from '@/lib/salaryWindow';

import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator, Lock, CheckCircle, Clock, Plus, Search, Loader2, RotateCcw, AlertCircle, History, TrendingUp, TrendingDown, FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError } from '@/lib/handleSupabaseError';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';
import { normalizeAttendanceStatus, isPresentStatus, isAbsentStatus, isLeaveStatus } from '@/lib/attendanceStatus';
import { SalarySheetDialog } from '@/components/salary/SalarySheetDialog';
import { BulkAdjustmentDialog } from '@/components/salary/BulkAdjustmentDialog';
import { AdjustmentHistoryDialog } from '@/components/salary/AdjustmentHistoryDialog';
import { SalarySheetAuditPanel } from '@/components/finance/SalarySheetAuditPanel';
import {
  computeSalaryRows,
  buildPayoutPayload,
  type StudentPayoutRow as SalaryCalcStudentRow,
  type RoleSalaryRow as SalaryCalcRoleRow,
  type TeacherSalaryRow as SalaryCalcTeacherRow,
} from '@/lib/salaryCalc';

import { trackActivity } from '@/lib/activityLogger';
import { useUrlState } from '@/hooks/useUrlState';
import { StickyScrollTable } from '@/components/ui/sticky-scroll-table';

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

async function mergeProfileSensitiveRows(profiles: any[]) {
  const profileIds = profiles.map((profile: any) => profile.id).filter(Boolean);
  if (profileIds.length === 0) return profiles;

  const { data: sensitiveRows } = await (supabase as any)
    .from('profile_sensitive_data')
    .select('user_id, whatsapp_number, bank_name, bank_account_title, bank_account_number, bank_iban')
    .in('user_id', profileIds);
  const sensitiveByUser = new Map<string, any>((sensitiveRows || []).map((row: any) => [row.user_id, row] as [string, any]));

  return profiles.map((profile: any) => ({
    ...profile,
    ...(sensitiveByUser.get(profile.id) ?? {}),
  }));
}

const now = new Date();
const currentSalaryMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

type StudentPayoutRow = SalaryCalcStudentRow;
export type RoleSalaryRow = SalaryCalcRoleRow;
type TeacherSalaryRow = SalaryCalcTeacherRow;


const REVERT_REASONS = [
  'Incorrect amount',
  'Wrong month',
  'Duplicate entry',
  'Payment not completed',
  'Other',
];

const REVISION_REASONS = [
  'Back-dated salary recalculation',
  'Assignment start / end date changed',
  'Attendance corrected after payment',
  'Leave or absence updated',
  'Rate or fee plan changed',
  'Adjustment (bonus / deduction) added',
  'Rounding difference only',
  'Other',
];

type StaffFilter = 'all' | 'teachers' | 'staff';
type SalaryView = 'active' | 'archived';
type SettlementAction = 'settle_separately' | 'carry_forward' | 'accept_no_action';

export default function SalaryEngine() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const isTeacherView = activeRole === 'teacher';
  const queryClient = useQueryClient();

  const [salaryMonth, setSalaryMonth] = useUrlState('month', currentSalaryMonth);
  const [searchQuery, setSearchQuery] = useUrlState('q', '');
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});
  const [editRoleAmounts, setEditRoleAmounts] = useState<Record<string, number>>({});
  const [staffFilter, setStaffFilter] = useUrlState<StaffFilter>('staff', 'all');
  const [salaryView, setSalaryView] = useUrlState<SalaryView>('sheet', 'active');

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkDeductOpen, setBulkDeductOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('audit') === '1',
  );
  const [revisionTeacher, setRevisionTeacher] = useState<TeacherSalaryRow | null>(null);
  const [revisionReason, setRevisionReason] = useState('Back-dated salary recalculation');
  const [revisionReasonOther, setRevisionReasonOther] = useState('');
  const [settlementAction, setSettlementAction] = useState<SettlementAction>('settle_separately');

  
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
      const { data } = await supabase.from('profiles').select('id, full_name, email, country, city').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return mergeProfileSensitiveRows(data || []);
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
        .select('id, full_name, email, country, city')
        .in('id', staffUserIds)
        .is('archived_at', null)
        .order('full_name');
      return mergeProfileSensitiveRows(data || []);
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
        .select('id, teacher_id, student_id, payout_amount, payout_type, effective_from_date, effective_to_date, status_effective_date, status, salary_linked, is_temporary, original_assignment_id, profiles!student_teacher_assignments_student_id_fkey(full_name)')
        // 'left'/'completed' assignments still earn salary for the months they were active —
        // the effective date window below decides inclusion, not the current status.
        .in('status', [...SALARY_ASSIGNMENT_STATUSES]);
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
        .eq('salary_month', salaryMonth)
        .or('is_archived.is.null,is_archived.eq.false');
      return data || [];
    },
  });

  // Admin-only: archived (superseded) payouts for audit / watermark history
  const { data: archivedPayouts = [] } = useQuery({
    queryKey: ['salary-payouts-archived', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_payouts')
        .select('*')
        .eq('salary_month', salaryMonth)
        .eq('is_archived', true);
      return data || [];
    },
  });


  const { data: feeInvoices = [] } = useQuery({
    queryKey: ['fee-invoices-salary', salaryMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('id, student_id, assignment_id, status, paid_at')
        .is('voided_at', null)
        .eq('is_archived', false)
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

  // ── Calculation Engine (single source of truth: src/lib/salaryCalc.ts) ──

  const salaryData: TeacherSalaryRow[] = useMemo(() => computeSalaryRows({
    profiles: allSalariedProfiles,
    assignments,
    attendance,
    leaveEvents,
    extraClasses,
    salaryAdjustments,
    existingPayouts,
    feeInvoices,
    schedules,
    staffSalaries,
    salaryMonth,
    editAmounts,
    editRoleAmounts,
  }), [allSalariedProfiles, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments, existingPayouts, feeInvoices, schedules, staffSalaries, salaryMonth, editAmounts, editRoleAmounts]);


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
    const presentDates = new Set(teacherAtt.filter((a: any) => isPresentStatus(a.status)).map((a: any) => a.class_date));
    const absentDates = new Set(teacherAtt.filter((a: any) => isAbsentStatus(a.status)).map((a: any) => a.class_date));
    // Leave = admin-approved leave events + any day marked as leave on the register
    const leaveDateSet = new Set<string>(
      teacherAtt.filter((a: any) => isLeaveStatus(a.status)).map((a: any) => a.class_date as string),
    );
    leaveEvents
      .filter((l: any) => l.teacher_id === selectedTeacherId)
      .forEach((l: any) => {
        try {
          eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
            .forEach(d => leaveDateSet.add(format(d, 'yyyy-MM-dd')));
        } catch { /* ignore malformed ranges */ }
      });
    const leaveDates = [...leaveDateSet].filter(d => d >= monthStart && d <= monthEnd).length;
    return {
      present: presentDates.size,
      absent: absentDates.size,
      leave: leaveDates,
      notMarked: Math.max(0, daysInMonth - presentDates.size - absentDates.size - leaveDates),
    };
  }, [selectedTeacherId, attendance, leaveEvents, daysInMonth, monthStart, monthEnd]);


  const selectedAdjustments = useMemo(() => {
    if (!selectedTeacherId) return [];
    return salaryAdjustments.filter((a: any) => a.teacher_id === selectedTeacherId);
  }, [selectedTeacherId, salaryAdjustments]);

  // ── Mutations ──

  const savePayout = useMutation({
    mutationFn: async ({ teacher, reason, action, note }: { teacher: TeacherSalaryRow; reason?: string; action?: SettlementAction; note?: string }) => {
      const existing = existingPayouts.find((p: any) => p.teacher_id === teacher.teacherId);
      const payload = buildPayoutPayload(teacher, salaryMonth);

      if (existing) {
        if (existing.status === 'locked' || existing.status === 'paid' || existing.status === 'partially_paid') {
          if (!reason || !action) throw new Error('Revision details are required');
          const { data, error } = await (supabase as any).rpc('revise_salary_payout', {
            _payout_id: existing.id,
            _base_salary: payload.base_salary,
            _extra_class_amount: payload.extra_class_amount,
            _adjustment_amount: payload.adjustment_amount,
            _expense_amount: payload.expense_amount,
            _deductions: payload.deductions,
            _calculation_json: payload.calculation_json,
            _change_reason: reason,
            _settlement_action: action,
            _settlement_note: note || null,
          });
          if (error) throw error;
          const delta = Number(data?.delta_to_settle ?? 0);
          if (Math.abs(delta) > 0.01 && action !== 'accept_no_action') {
            toast({
              title: 'Salary revised',
              description: action === 'carry_forward'
                ? `${delta > 0 ? 'Add' : 'Deduct'} PKR ${Math.abs(delta).toFixed(2)} on the next salary sheet.`
                : delta > 0
                  ? `PKR ${delta.toFixed(2)} remains payable separately.`
                  : `PKR ${Math.abs(delta).toFixed(2)} is recoverable separately.`,
            });
          }
          return;
        }
        // Saving the sheet re-syncs it with live data, so clear any staleness flag.
        const { error } = await supabase
          .from('salary_payouts')
          .update({ ...payload, revision_required_at: null, revision_reason: null } as any)
          .eq('id', existing.id);
        if (error) throw error;

      } else {
        const { error } = await supabase.from('salary_payouts').insert(payload);
        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast({ title: 'Salary saved & confirmed' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
      setRevisionTeacher(null);
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
  });

  const markPaid = useMutation({
    mutationFn: async ({ teacherId, type, reason, invoiceNumber, receiptUrls, amountPaid, paymentDate }: { teacherId: string; type: 'full' | 'partial'; reason?: string; invoiceNumber?: string; receiptUrls?: string[]; amountPaid?: number; paymentDate?: string }) => {
      // Always re-save payout with current calculated values before marking paid
      const teacher = salaryData.find(t => t.teacherId === teacherId);
      if (teacher) {
        const existingPayout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
        if (!existingPayout || (existingPayout.status !== 'locked' && existingPayout.status !== 'paid')) {
          await savePayout.mutateAsync({ teacher });
        }
      }
      const payoutRefresh = (await supabase.from('salary_payouts').select('id, net_salary').eq('teacher_id', teacherId).eq('salary_month', salaryMonth).or('is_archived.is.null,is_archived.eq.false').single()).data;
      if (!payoutRefresh) throw new Error('Save payout first');

      // Use the current calculated net salary from UI, falling back to DB value
      const netSalary = teacher ? teacher.netSalary : (Number(payoutRefresh.net_salary) || 0);
      const paidAtDate = paymentDate || new Date().toISOString();

      if (type === 'partial') {
        const paidAmount = amountPaid || 0;
        const finalStatus = paidAmount >= netSalary ? 'paid' : 'partially_paid';
        const { error } = await supabase.from('salary_payouts').update({
          status: finalStatus,
          amount_paid: paidAmount,
          partial_notes: reason || null,
          paid_at: paidAtDate,
          paid_by: user?.id || null,
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
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
        paid_at: new Date().toISOString(),
        paid_by: user?.id || null,
        receipt_urls: mergedReceipts,
        receipt_url: mergedReceipts[0] || null,
      }).eq('id', payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Top-up payment recorded' });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
      queryClient.invalidateQueries({ queryKey: ['salary-payouts-archived'] });
      setRevertModalOpen(false);
      setRevertTeacherId(null);
      setRevertReason('');
      setRevertOtherText('');
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
  });

  const addAdjustment = useMutation({
    mutationFn: async () => {
      const amountVal = parseFloat(adjForm.amount) || 0;
      const payload: any = {
        teacher_id: adjForm.teacher_id,
        salary_month: salaryMonth,
        adjustment_type: adjForm.adjustment_type,
        amount: adjForm.mode === 'percentage' ? 0 : amountVal,
        reason: adjForm.reason || null,
        created_by: user?.id,
        adjustment_mode: adjForm.mode,
        percentage_value: adjForm.mode === 'percentage' ? amountVal : null,
      };
      // For percentage mode, resolve amount at insert time (we'll compute against base later in display)
      const { error } = await supabase.from('salary_adjustments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Adjustment added' });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
      setAdjustmentModalOpen(false);
      setAdjForm({ teacher_id: '', adjustment_type: 'bonus', amount: '', reason: '', mode: 'flat' });
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
  });

  const bulkAdjustment = useMutation({
    mutationFn: async (data: { staffIds: string[]; adjustmentType: string; mode: 'flat' | 'percentage'; value: number; reason: string }) => {
      const batchId = crypto.randomUUID();
      const rows = data.staffIds.map(id => ({
        teacher_id: id,
        salary_month: salaryMonth,
        adjustment_type: data.adjustmentType,
        amount: data.mode === 'percentage' ? 0 : data.value,
        reason: data.reason || null,
        created_by: user?.id,
        adjustment_mode: data.mode,
        percentage_value: data.mode === 'percentage' ? data.value : null,
        is_bulk: true,
        bulk_batch_id: batchId,
      }));
      const { error } = await supabase.from('salary_adjustments').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Bulk adjustment applied' });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
      setBulkAddOpen(false);
      setBulkDeductOpen(false);
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
  });

  // ── Helpers ──

  const getStatusBadge = (status: string, payout?: any) => {
    if (payout?.is_archived) {
      return <Badge className="bg-red-50 text-red-700 border-red-200 gap-1"><AlertCircle className="h-3 w-3" /> VOID</Badge>;
    }
    if (payout?.is_revised) {
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle className="h-3 w-3" /> REVISED</Badge>;
    }
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
  const revisionPayout = revisionTeacher
    ? existingPayouts.find((p: any) => p.teacher_id === revisionTeacher.teacherId)
    : null;
  const revisionPaid = Number(revisionPayout?.amount_paid) || 0;
  const revisionSavedNet = Number(revisionPayout?.net_salary) || 0;
  const revisionCalculatedNet = revisionTeacher?.netSalary || 0;
  const revisionSettlementDelta = revisionCalculatedNet - revisionPaid;

  const openRevision = (teacher: TeacherSalaryRow, payout: any) => {
    if (payout && ['locked', 'paid', 'partially_paid'].includes(payout.status)) {
      setRevisionTeacher(teacher);
      setRevisionReason(payout.revision_reason || 'Back-dated salary recalculation');
      setSettlementAction('settle_separately');
      return;
    }
    savePayout.mutate({ teacher });
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
              <Button
                size="sm"
                variant={salaryView === 'active' ? 'default' : 'outline'}
                onClick={() => setSalaryView('active')}
              >
                Active Sheets
              </Button>
              <Button
                size="sm"
                variant={salaryView === 'archived' ? 'default' : 'outline'}
                className={salaryView === 'archived' ? '' : 'border-red-200 text-red-700 hover:bg-red-50'}
                onClick={() => setSalaryView('archived')}
              >
                <AlertCircle className="h-4 w-4 mr-1" /> VOID Archive ({archivedPayouts.length})
              </Button>
              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50" onClick={() => setBulkAddOpen(true)}>
                <TrendingUp className="h-4 w-4 mr-1" /> Bulk Addition
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setBulkDeductOpen(true)}>
                <TrendingDown className="h-4 w-4 mr-1" /> Bulk Deduction
              </Button>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setAuditOpen(true)}>
                <AlertCircle className="h-4 w-4 mr-1" /> Sheet Audit
              </Button>
              <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>

                <History className="h-4 w-4 mr-1" /> History
              </Button>
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
        <Card className={salaryView === 'archived' ? 'border-red-200/70' : undefined}>
          {!isTeacherView && salaryView === 'archived' && (
            <CardHeader className="pb-2 bg-red-50/70 border-b border-red-100">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" /> VOID / Superseded Salary Sheets
              </CardTitle>
              <p className="text-xs text-red-700/80">These are old locked/paid sheets kept only for audit. Open them to see the VOID watermark.</p>
            </CardHeader>
          )}
          <CardContent className="p-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Additions</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  {!isTeacherView && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryView === 'active' && filteredData.length === 0 && (
                  <TableRow><TableCell colSpan={isTeacherView ? 7 : 8} className="text-center py-12 text-muted-foreground">No salary data for this month</TableCell></TableRow>
                )}
                {salaryView === 'archived' && archivedPayouts.length === 0 && (
                  <TableRow><TableCell colSpan={isTeacherView ? 7 : 8} className="text-center py-12 text-muted-foreground">No VOID / superseded salary sheets for this month yet.</TableCell></TableRow>
                )}
                {salaryView === 'archived' && archivedPayouts.map((p: any) => {
                  const profile = allSalariedProfiles.find((x: any) => x.id === p.teacher_id);
                  return (
                    <TableRow key={p.id} className="bg-red-50/25">
                      <TableCell>
                        <div className="font-medium text-foreground">{profile?.full_name || p.teacher_id.slice(0, 8)}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-[10px]">VOID — SUPERSEDED</Badge>
                          {p.archive_reason && <span className="text-xs text-muted-foreground italic">{p.archive_reason}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">PKR {Number(p.base_salary || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">PKR {Number(p.extra_class_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">PKR {Number(p.adjustment_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">PKR {Number(p.deductions || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        <div className="space-y-0.5">
                          <div>PKR {Number(p.net_salary || 0).toFixed(2)}</div>
                          <div className="text-xs font-normal text-muted-foreground">Paid: PKR {Number(p.amount_paid || 0).toFixed(2)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status || 'paid', p)}</TableCell>
                      {!isTeacherView && (
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="gap-1 border-red-200 text-red-700 hover:bg-red-50" onClick={() => window.open(`/finance/print/salary/${p.id}`, '_blank')}>
                            <FileText className="h-3.5 w-3.5" /> View VOID Sheet
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {salaryView === 'active' && filteredData.map(teacher => {
                  const payout = existingPayouts.find((p: any) => p.teacher_id === teacher.teacherId);
                  const canRevert = payout && (payout.status === 'confirmed' || payout.status === 'paid' || payout.status === 'locked' || payout.status === 'partially_paid');
                  const willReviseLockedSheet = payout && (payout.status === 'locked' || payout.status === 'paid' || payout.status === 'partially_paid');
                  const canSave = !!payout || teacher.payoutStatus !== 'locked';
                  
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
                          {(() => {
                            const oldSheet = (archivedPayouts as any[]).find(
                              (a: any) => a.teacher_id === teacher.teacherId && a.salary_month === salaryMonth,
                            );
                            const drifted = payout && (payout.revision_required_at || Math.abs((Number(payout.net_salary) || 0) - teacher.netSalary) > 0.01);
                            if (!payout?.is_revised && !drifted) return null;
                            const label = payout?.is_revised ? 'REVISED' : 'REVISION DUE';
                            const cls = payout?.is_revised
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200';
                            const title = oldSheet ? 'Open the previous (superseded) sheet' : 'No previous sheet archived yet';
                            return (
                              <Badge
                                variant="outline"
                                title={title}
                                className={`text-[10px] ${cls} ${oldSheet ? 'cursor-pointer hover:opacity-80' : ''}`}
                                onClick={() => oldSheet && window.open(`/finance/print/salary/${oldSheet.id}`, '_blank')}
                              >
                                {label}
                              </Badge>
                            );
                          })()}


                        </div>

                      </TableCell>
                      <TableCell className="text-right tabular-nums">PKR {teacher.baseSalary.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">PKR {teacher.extraClassAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">PKR {teacher.adjustmentAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">PKR {teacher.deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {(() => {
                          const amountPaid = Number(payout?.amount_paid) || 0;
                          const balance = teacher.netSalary - amountPaid;
                          return (
                            <div className="space-y-0.5">
                              <div>PKR {balance.toFixed(2)}</div>
                              {amountPaid > 0 && (
                                <div className="text-xs font-normal text-emerald-600">Paid: PKR {amountPaid.toFixed(2)}</div>
                              )}
                              {amountPaid > 0 && balance > 0.01 && (
                                <div className="text-xs font-normal text-amber-600">Remaining: PKR {balance.toFixed(2)}</div>
                              )}
                              {balance !== teacher.netSalary && (
                                <div className="text-xs font-normal text-muted-foreground">Net: PKR {teacher.netSalary.toFixed(2)}</div>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{getStatusBadge(teacher.payoutStatus, payout)}</TableCell>
                      {!isTeacherView && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedTeacherId(teacher.teacherId); setSheetOpen(true); }}>
                              View Sheet
                            </Button>
                            <Button 
                              size="sm" 
                              variant="default" 
                              onClick={() => openRevision(teacher, payout)} 
                              disabled={!canSave || savePayout.isPending}
                              title={willReviseLockedSheet ? 'Archive the locked/paid sheet and create a revised sheet' : (payout ? 'Revise this salary sheet' : 'Create salary sheet')}
                            >
                              {savePayout.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                              {payout ? 'Revise' : 'Create'}
                            </Button>
                            {payout?.revises_payout_id && (
                              <Button size="sm" variant="outline" onClick={() => window.open(`/finance/print/salary/${payout.revises_payout_id}`, '_blank')}>
                                <History className="h-3.5 w-3.5 mr-1" /> Legacy sheet
                              </Button>
                            )}
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
          teacher={selectedTeacher ? { ...selectedTeacher, payoutId: (existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId)?.id || null), payout: existingPayouts.find((p: any) => p.teacher_id === selectedTeacherId) || null } as any : null}
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
          onMarkPaid={(type, reason, invoiceNumber, receiptUrls, amountPaid, paymentDate) => {
            if (selectedTeacherId) {
              markPaid.mutate({ teacherId: selectedTeacherId, type, reason, invoiceNumber, receiptUrls, amountPaid, paymentDate });
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

        {/* ── Cross-month Sheet Audit ── */}
        <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Salary Sheet Audit</DialogTitle>
              <DialogDescription>
                Reconciles every teacher × month against the assignments actually active in that month
                (month-granular end dates, ended assignments still paid) — including months where no sheet
                was ever generated. Use “Previous version” to open the archived sheet for that month.
              </DialogDescription>
            </DialogHeader>
            <SalarySheetAuditPanel
              onOpenMonth={(m, view) => {
                setSalaryMonth(m);
                setSalaryView(view === 'archived' ? 'archived' : 'active');
                setAuditOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* ── Paid Sheet Revision ── */}
        <Dialog open={!!revisionTeacher} onOpenChange={(open) => !open && setRevisionTeacher(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Review salary revision</DialogTitle>
              <DialogDescription>
                This compares the original salary sheet, the payment you actually recorded, and today’s recalculation. It does not assume the receipt amount was wrong.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Original sheet</p>
                  <p className="font-semibold tabular-nums">PKR {revisionSavedNet.toFixed(2)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Actually paid</p>
                  <p className="font-semibold tabular-nums">PKR {revisionPaid.toFixed(2)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Recalculated</p>
                  <p className="font-semibold tabular-nums">PKR {revisionCalculatedNet.toFixed(2)}</p>
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-amber-900">
                  {revisionSettlementDelta > 0.01
                    ? `The recalculated salary is PKR ${revisionSettlementDelta.toFixed(2)} more than the recorded payment.`
                    : revisionSettlementDelta < -0.01
                      ? `The recorded payment is PKR ${Math.abs(revisionSettlementDelta).toFixed(2)} more than the recalculated salary.`
                      : 'The recorded payment matches the recalculated salary.'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>What should happen to this difference?</Label>
                <Select value={settlementAction} onValueChange={(value) => setSettlementAction(value as SettlementAction)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="settle_separately">Pay / recover separately</SelectItem>
                    <SelectItem value="carry_forward">Carry to next salary</SelectItem>
                    <SelectItem value="accept_no_action">Accept rounded payment — no further action</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choosing “no further action” closes the difference as an accepted rounding or management decision; it does not create an adjustment.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Reason for recalculation</Label>
                <Select value={revisionReason} onValueChange={setRevisionReason}>
                  <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {REVISION_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {revisionReason === 'Other' && (
                  <Textarea
                    value={revisionReasonOther}
                    onChange={(event) => setRevisionReasonOther(event.target.value)}
                    placeholder="Describe what changed in the salary calculation"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Settlement note (optional)</Label>
                <Textarea value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} placeholder="e.g. Rounded payment of PKR 3,000 accepted; nothing to carry forward" />
              </div>

              {revisionPayout?.id && (
                <Button variant="outline" className="w-full" onClick={() => window.open(`/finance/print/salary/${revisionPayout.id}`, '_blank')}>
                  <FileText className="h-4 w-4 mr-2" /> Open original paid sheet
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRevisionTeacher(null)}>Cancel</Button>
              <Button
                onClick={() => revisionTeacher && savePayout.mutate({
                  teacher: revisionTeacher,
                  reason: (revisionReason === 'Other' ? revisionReasonOther.trim() : revisionReason),
                  action: settlementAction,
                  note: settlementNote.trim(),
                })}
                disabled={!revisionReason || (revisionReason === 'Other' && !revisionReasonOther.trim()) || savePayout.isPending}
              >
                {savePayout.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save revised sheet & decision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>Mode</Label>
                  <Select value={adjForm.mode} onValueChange={v => setAdjForm(p => ({ ...p, mode: v as 'flat' | 'percentage' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{adjForm.mode === 'percentage' ? 'Percentage (%)' : 'Amount (PKR)'}</Label>
                <Input type="number" value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} placeholder={adjForm.mode === 'percentage' ? '10' : '5000'} />
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

        {/* ── Bulk Adjustment Dialogs ── */}
        <BulkAdjustmentDialog
          open={bulkAddOpen}
          onOpenChange={setBulkAddOpen}
          type="addition"
          staffMembers={allSalariedProfiles.map((p: any) => ({ id: p.id, full_name: p.full_name }))}
          salaryMonth={salaryMonth}
          onSubmit={(data) => bulkAdjustment.mutate(data)}
          isPending={bulkAdjustment.isPending}
        />
        <BulkAdjustmentDialog
          open={bulkDeductOpen}
          onOpenChange={setBulkDeductOpen}
          type="deduction"
          staffMembers={allSalariedProfiles.map((p: any) => ({ id: p.id, full_name: p.full_name }))}
          salaryMonth={salaryMonth}
          onSubmit={(data) => bulkAdjustment.mutate({ ...data, adjustmentType: 'deduction' })}
          isPending={bulkAdjustment.isPending}
        />

        {/* ── Adjustment History ── */}
        <AdjustmentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          salaryMonth={salaryMonth}
        />
      </div>
    </DashboardLayout>
  );
}
