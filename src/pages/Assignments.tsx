import React, { useState, useMemo, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, GraduationCap, Trash2, Loader2, UserPlus, BookOpen, Pencil, Upload, ArrowRightLeft, Banknote, Eye, Download, Plus, ArrowUp, ArrowDown, ArrowUpDown, X, DollarSign, XCircle, History as HistoryIcon, Lock, AlertTriangle } from 'lucide-react';
import { AssignmentHistoryDrawer } from '@/components/assignments/AssignmentHistoryDrawer';
import { TableToolbar } from '@/components/ui/table-toolbar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAssignmentPayouts } from '@/lib/assignmentPayouts';
import { handleSupabaseError } from '@/lib/handleSupabaseError';
import { useDivision } from '@/contexts/DivisionContext';
import { BulkAssignmentImportDialog } from '@/components/assignments/BulkAssignmentImportDialog';
import { AssignmentDetailDialog } from '@/components/assignments/AssignmentDetailDialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDisplayDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { useUrlState } from '@/hooks/useUrlState';
import { StickyScrollTable } from '@/components/ui/sticky-scroll-table';

import { ASSIGNMENT_STATUS_RULES, getStatusRule, shouldArchiveOnLeft, type AssignmentStatus as RuleAssignmentStatus } from '@/lib/assignmentStatusRules';
import { trackActivity } from '@/lib/activityLogger';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  on_hold: { label: 'On Hold', color: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', color: 'bg-blue-500', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  left: { label: 'Left', color: 'bg-rose-600', badgeClass: 'bg-rose-600/10 text-rose-600 border-rose-600/20' },
} as const;

interface Profile {
  id: string;
  full_name: string;
}

interface Subject {
  id: string;
  name: string;
}

type AssignmentStatus = RuleAssignmentStatus;

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  subject_id: string | null;
  status: AssignmentStatus;
  teacher_name: string;
  student_name: string;
  subject_name: string | null;
  created_at: string;
  payout_amount: number;
  payout_type: string;
  effective_from_date: string | null;
  effective_to_date: string | null;
  transfer_type: string | null;
  parent_assignment_id: string | null;
  substitute_end_date: string | null;
  requires_schedule: boolean;
  requires_planning: boolean;
  requires_attendance: boolean;
}

export default function Assignments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivision } = useDivision();
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlState<AssignmentStatus | 'all'>('status', 'active');
  const [searchTerm, setSearchTerm] = useUrlState('q', '');
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'newest'>('az');
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Per-column sort + filters
  type SortKey = 'teacher_name' | 'student_name' | 'subject_name' | 'payout_amount' | 'status' | 'created_at';
  const [sortKey, setSortKey] = useUrlState<SortKey>('sort', 'created_at');
  const [sortDir, setSortDir] = useUrlState<'asc' | 'desc'>('dir', 'desc');
  const [teacherFilter, setTeacherFilter] = useUrlState('teacher', 'all');
  const [subjectFilter, setSubjectFilter] = useUrlState('subject', 'all');
  const [payoutTypeFilter, setPayoutTypeFilter] = useUrlState('payout', 'all');
  const [reassignDialog, setReassignDialog] = useState<Assignment | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignPayoutAmount, setReassignPayoutAmount] = useState('');
  const [reassignPayoutType, setReassignPayoutType] = useState('monthly');
  const [reassignEffectiveDate, setReassignEffectiveDate] = useState('');
  const [reassignTransferType, setReassignTransferType] = useState<'permanent' | 'substitute'>('permanent');
  const [reassignSubstituteEndDate, setReassignSubstituteEndDate] = useState('');
  // Status change dialog
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ assignment: Assignment; newStatus: AssignmentStatus } | null>(null);
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusChangeReason, setStatusChangeReason] = useState('');
  // Payout fields
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState('monthly');
  const [effectiveFromDate, setEffectiveFromDate] = useState('');
  const [effectiveToDate, setEffectiveToDate] = useState('');
  // Billing plan detail dialog
  const [billingDetailAssignmentId, setBillingDetailAssignmentId] = useState<string | null>(null);
  const [detailAssignmentId, setDetailAssignmentId] = useState<string | null>(null);
  // Edit modal — change type pattern
  type ChangeType = 'payout' | 'info' | 'close';
  const [changeType, setChangeType] = useState<ChangeType>('payout');
  const [closeReason, setCloseReason] = useState('');
  const [lockedConfirm, setLockedConfirm] = useState<{ count: number; effectiveDate: string; onConfirm: () => void } | null>(null);
  // Info-correction fields
  const [infoRequiresSchedule, setInfoRequiresSchedule] = useState(true);
  const [infoRequiresPlanning, setInfoRequiresPlanning] = useState(true);
  const [infoRequiresAttendance, setInfoRequiresAttendance] = useState(true);
  const [infoNotes, setInfoNotes] = useState('');
  // Close fields
  const [closeStatus, setCloseStatus] = useState<'completed' | 'left'>('completed');
  const [voidPendingInvoices, setVoidPendingInvoices] = useState(false);
  // History drawer
  const [historyAssignmentId, setHistoryAssignmentId] = useState<string | null>(null);

  // Fetch teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');
      if (roleError) throw roleError;
      const teacherIds = (roleRows ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (teacherIds.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds)
        .order('full_name', { ascending: true });
      if (profileError) throw profileError;
      return (profiles ?? []) as Profile[];
    },
  });

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (roleError) throw roleError;
      const studentIds = (roleRows ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (studentIds.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, registration_id, email')
        .in('id', studentIds)
        .order('full_name', { ascending: true });
      if (profileError) throw profileError;
      return (profiles ?? []) as (Profile & { registration_id?: string; email?: string })[];
    },
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  // Fetch existing assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['student-teacher-assignments', activeDivision?.id],
    queryFn: async () => {
      let query = supabase
        .from('student_teacher_assignments')
        .select(`
          id, teacher_id, student_id, subject_id, status, created_at,
          effective_from_date, effective_to_date,
          transfer_type, parent_assignment_id, substitute_end_date,
          requires_schedule, requires_planning, requires_attendance,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name),
          subject:subjects(name)
        `)
        .order('created_at', { ascending: false });
      if (activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const payoutMap = await fetchAssignmentPayouts((data || []).map((r: any) => r.id));
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        subject_id: row.subject_id,
        status: row.status || 'active',
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
        subject_name: row.subject?.name || null,
        created_at: row.created_at,
        payout_amount: payoutMap.get(row.id)?.payout_amount || 0,
        payout_type: payoutMap.get(row.id)?.payout_type || 'monthly',
        effective_from_date: row.effective_from_date,
        effective_to_date: row.effective_to_date,
        transfer_type: row.transfer_type,
        parent_assignment_id: row.parent_assignment_id,
        substitute_end_date: row.substitute_end_date,
        requires_schedule: row.requires_schedule ?? true,
        requires_planning: row.requires_planning ?? true,
        requires_attendance: row.requires_attendance ?? true,
      })) as Assignment[];
    },
  });

  // Auto-revert expired substitute assignments: complete the substitute, resume the parent
  useEffect(() => {
    if (!assignments.length) return;
    const today = new Date().toISOString().split('T')[0];
    const expired = assignments.filter(a =>
      a.transfer_type === 'substitute' &&
      a.status === 'active' &&
      a.parent_assignment_id &&
      a.substitute_end_date &&
      a.substitute_end_date < today
    );
    if (!expired.length) return;
    (async () => {
      const sb = supabase as any;
      for (const sub of expired) {
        await sb.from('student_teacher_assignments')
          .update({ status: 'completed', status_effective_date: sub.substitute_end_date })
          .eq('id', sub.id);
        await sb.from('assignment_history')
          .update({ ended_at: new Date(sub.substitute_end_date!).toISOString() })
          .eq('assignment_id', sub.id)
          .is('ended_at', null);
        await sb.from('schedules')
          .update({ is_active: false })
          .eq('assignment_id', sub.id);
        // Resume parent
        await sb.from('student_teacher_assignments')
          .update({ status: 'active', status_effective_date: sub.substitute_end_date })
          .eq('id', sub.parent_assignment_id)
          .eq('status', 'on_hold');
        await sb.from('schedules')
          .update({ is_active: true })
          .eq('assignment_id', sub.parent_assignment_id);
      }
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  // Fetch linked billing plans for all assignments (read-only display)
  const assignmentIds = assignments.map(a => a.id);
  const { data: linkedPlans = [] } = useQuery({
    queryKey: ['linked-billing-plans', assignmentIds],
    queryFn: async () => {
      if (assignmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('student_billing_plans')
        .select('id, assignment_id, net_recurring_fee, currency, is_active, fee_packages!student_billing_plans_base_package_id_fkey(name)')
        .in('assignment_id', assignmentIds);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: assignmentIds.length > 0,
  });

  const plansByAssignment = useMemo(() => {
    const map: Record<string, any> = {};
    linkedPlans.forEach(p => { if (p.assignment_id) map[p.assignment_id] = p; });
    return map;
  }, [linkedPlans]);

  // Locked salary months per teacher (drives the lock icon on assignment rows)
  const { data: lockedSalaryRows = [] } = useQuery({
    queryKey: ['locked-salary-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_payouts')
        .select('teacher_id, salary_month')
        .in('status', ['paid', 'locked']);
      if (error) throw error;
      return (data || []) as { teacher_id: string; salary_month: string }[];
    },
  });
  const lockedTeacherMonth = useMemo(() => {
    const map: Record<string, string> = {};
    lockedSalaryRows.forEach(r => {
      const cur = map[r.teacher_id];
      if (!cur || r.salary_month > cur) map[r.teacher_id] = r.salary_month;
    });
    return map;
  }, [lockedSalaryRows]);

  // Pending invoices that would be affected by the chosen close end date
  const { data: pendingInvoicesAfterClose = [] } = useQuery({
    queryKey: ['pending-invoices-after-close', editingAssignment?.id, effectiveToDate],
    enabled: !!editingAssignment && changeType === 'close' && !!effectiveToDate,
    queryFn: async () => {
      const endMonth = effectiveToDate.slice(0, 7);
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('id, billing_month')
        .eq('assignment_id', editingAssignment!.id)
        .eq('status', 'pending')
        .gt('billing_month', endMonth);
      if (error) throw error;
      return (data || []) as { id: string; billing_month: string }[];
    },
  });

  // Create assignments mutation (academic only - no billing)
  const createMutation = useMutation({
    mutationFn: async ({ teacherId, studentIds, subjectId }: { teacherId: string; studentIds: string[]; subjectId?: string }) => {
      const records = studentIds.map(studentId => ({
        teacher_id: teacherId,
        student_id: studentId,
        subject_id: subjectId || null,
        payout_amount: parseFloat(payoutAmount) || 0,
        payout_type: payoutType,
        effective_from_date: effectiveFromDate || null,
        division_id: activeDivision?.id || null,
        branch_id: activeDivision?.branch_id || null,
      }));
      // Only ONE active assignment may exist per teacher+student; closed/past
      // periods are preserved for salary history, so we never upsert over them.
      const { data: existingActive } = await supabase
        .from('student_teacher_assignments')
        .select('id, student_id')
        .eq('teacher_id', teacherId)
        .in('student_id', studentIds)
        .eq('status', 'active')
        .is('effective_to_date', null);
      const activeStudentIds = new Set((existingActive || []).map((r: any) => r.student_id));
      const toInsert = records.filter(r => !activeStudentIds.has(r.student_id));
      if (!toInsert.length) {
        throw new Error('These students already have an active assignment with this teacher');
      }
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .insert(toInsert)
        .select('id, student_id, teacher_id');
      if (error) throw error;

      // Seed assignment_history for new records
      if (data) {
        const historyRecords = data.map((row: any) => ({
          assignment_id: row.id,
          teacher_id: row.teacher_id,
          student_id: row.student_id,
          subject_id: row.subject_id,
        }));
        await supabase.from('assignment_history').insert(historyRecords);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Success', description: 'Assignments created successfully' });
      resetForm();
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('student_teacher_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Deleted', description: 'Assignment removed' });
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });

  // Update assignment mutation — HISTORY-PRESERVING.
  // Payout & effective_from changes write to assignment_history (do not mutate parent's effective_from_date).
  // Past paid/locked salary_payouts are NEVER touched.
  const updateMutation = useMutation({
    mutationFn: async ({ id, teacherId, subjectId }: { id: string; teacherId: string; subjectId?: string }) => {
      if (!editingAssignment) return;
      const prev = editingAssignment;

      // ─── Branch A: Update Payout (creates new history segment, future only) ───
      if (changeType === 'payout') {
        const newPayout = parseFloat(payoutAmount) || 0;
        const newPayoutType = payoutType;
        const newEffectiveFrom = effectiveFromDate || null;
        if (!newEffectiveFrom) throw new Error('Effective From date is required');

        // Back-dating is fully allowed. For any paid/locked salary months from the new
        // effective_from forward, run the archive + insert (revise_salary_payout) pattern
        // so the old locked sheet is preserved (VOID — SUPERSEDED watermark) and a NEW
        // revised sheet is created with prior_paid_amount carried over.
        const monthKey = newEffectiveFrom.slice(0, 7); // YYYY-MM
        const oldPayout = Number(prev.payout_amount) || 0;
        const payoutDelta = newPayout - oldPayout;

        const { data: paidInRange } = await supabase
          .from('salary_payouts')
          .select('id, salary_month, status, base_salary, extra_class_amount, adjustment_amount, expense_amount, deductions, calculation_json, is_archived')
          .eq('teacher_id', prev.teacher_id)
          .in('status', ['confirmed', 'paid', 'locked', 'partially_paid'])
          .eq('is_archived', false)
          .gte('salary_month', monthKey)
          .order('salary_month', { ascending: true });

        let revisedCount = 0;
        if (paidInRange && paidInRange.length > 0 && Math.abs(payoutDelta) > 0.001) {
          for (const p of paidInRange) {
            const newBase = Number(p.base_salary || 0) + payoutDelta;
            const { error: rErr } = await (supabase as any).rpc('revise_salary_payout', {
              _payout_id: p.id,
              _base_salary: newBase,
              _extra_class_amount: Number(p.extra_class_amount || 0),
              _adjustment_amount: Number(p.adjustment_amount || 0),
              _expense_amount: Number(p.expense_amount || 0),
              _deductions: Number(p.deductions || 0),
              _calculation_json: p.calculation_json ?? {},
              _change_reason: `Payout revised on assignment from ${oldPayout} to ${newPayout} effective ${newEffectiveFrom}`,
            });
            if (rErr) throw rErr;
            revisedCount++;
          }
          toast({
            title: 'Salary sheets revised',
            description: `${revisedCount} paid/locked month(s) archived as VOID — SUPERSEDED. New revised sheets issued with prior paid amount carried over.`,
          });
        }

        const { error: upErr } = await supabase
          .from('student_teacher_assignments')
          .update({
            payout_amount: newPayout,
            payout_type: newPayoutType,
            effective_from_date: newEffectiveFrom,
            // Payout rate revision — not an accountability window change. Past
            // paid sheets are archived/superseded, never dropped, and student
            // fee plans are untouched. Reason is auto-stamped for the audit log.
            status_change_reason:
              `Payout rate revised ${oldPayout} → ${newPayout} (${newPayoutType}) effective ${newEffectiveFrom}. ` +
              `Prior paid salary sheets archived as superseded; no fee/attendance records excluded.`,
          })
          .eq('id', id);
        if (upErr) throw upErr;


        // Close previous open history row
        const closeDate = new Date(newEffectiveFrom);
        closeDate.setDate(closeDate.getDate() - 1);
        await supabase
          .from('assignment_history')
          .update({ ended_at: closeDate.toISOString() })
          .eq('assignment_id', id)
          .is('ended_at', null);

        await supabase.from('assignment_history').insert({
          assignment_id: id,
          teacher_id: prev.teacher_id,
          student_id: prev.student_id,
          subject_id: prev.subject_id,
          started_at: new Date(newEffectiveFrom).toISOString(),
          ended_at: null,
          reason: 'Payout updated',
        });
        return;
      }

      // ─── Branch B: Correct Information (subject + flags + notes only, no dates) ───
      if (changeType === 'info') {
        const { error: upErr } = await supabase
          .from('student_teacher_assignments')
          .update({
            subject_id: subjectId || null,
            requires_schedule: infoRequiresSchedule,
            requires_planning: infoRequiresPlanning,
            requires_attendance: infoRequiresAttendance,
            ...(infoNotes ? { status_change_reason: infoNotes } : {}),
          })
          .eq('id', id);
        if (upErr) throw upErr;

        await supabase.from('assignment_history').insert({
          assignment_id: id,
          teacher_id: prev.teacher_id,
          student_id: prev.student_id,
          subject_id: subjectId || null,
          started_at: new Date().toISOString(),
          ended_at: null,
          reason: infoNotes ? `Info corrected — ${infoNotes}` : 'Info corrected',
        });
        return;
      }

      // ─── Branch C: Close Assignment ───
      if (changeType === 'close') {
        const endDate = effectiveToDate;
        if (!endDate) throw new Error('End Date is required');
        const todayStr = new Date().toISOString().split('T')[0];

        const { error: upErr } = await supabase
          .from('student_teacher_assignments')
          .update({
            status: closeStatus,
            effective_to_date: endDate,
            status_effective_date: todayStr,
            ...(closeReason ? { status_change_reason: closeReason } : {}),
          })
          .eq('id', id);
        if (upErr) throw upErr;

        // Optionally void downstream pending invoices
        if (voidPendingInvoices) {
          const endMonth = endDate.slice(0, 7);
          await supabase
            .from('fee_invoices')
            .update({ status: 'voided' })
            .eq('assignment_id', id)
            .eq('status', 'pending')
            .gt('billing_month', endMonth);
        }

        await supabase
          .from('assignment_history')
          .update({ ended_at: new Date(endDate).toISOString() })
          .eq('assignment_id', id)
          .is('ended_at', null);

        await supabase.from('assignment_history').insert({
          assignment_id: id,
          teacher_id: prev.teacher_id,
          student_id: prev.student_id,
          subject_id: prev.subject_id,
          started_at: new Date(endDate).toISOString(),
          ended_at: new Date(endDate).toISOString(),
          reason: closeReason ? `Assignment closed — ${closeReason}` : 'Assignment closed',
        });
        return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Saved', description: 'Change applied. Past records preserved.' });
      handleCancelEdit();
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });


  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, effectiveDate, reason }: { id: string; status: AssignmentStatus; effectiveDate?: string; reason?: string }) => {
      const assignment = assignments.find(a => a.id === id);
      const fromStatus = assignment?.status;

      const updatePayload: any = { status };
      if (reason) updatePayload.status_change_reason = reason;
      if (effectiveDate) {
        updatePayload.status_effective_date = effectiveDate;
        if (status === 'left' || status === 'completed') {
          updatePayload.effective_to_date = effectiveDate;
        }
        if (status === 'active') {
          updatePayload.effective_from_date = effectiveDate;
        }
      }
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw error;

      // Cascade: billing plan activation reflects the matrix
      // - completed/left   → deactivate plan for THIS assignment only
      // - on_hold          → leave plan as-is, invoice guard skips by status
      // - active (resume)  → reactivate plan
      
      if (status === 'completed' || status === 'left') {
        await supabase.from('student_billing_plans')
          .update({
            is_active: false,
            change_reason: `Assignment marked ${status}${effectiveDate ? ` effective ${effectiveDate}` : ''}`,
            updated_at: new Date().toISOString(),
          })
          .eq('assignment_id', id);

        // Cascade to existing UNPAID invoices for this student tied to this assignment
        // (directly or via plan). Paid/partially_paid invoices are immutable.
        if (effectiveDate && assignment) {
          const effDate = effectiveDate; // 'YYYY-MM-DD'
          // Plans linked to this assignment
          const { data: linkedPlans } = await supabase
            .from('student_billing_plans')
            .select('id')
            .eq('assignment_id', id);
          const planIds = (linkedPlans || []).map((p: any) => p.id);

          // Fetch all pending invoices for this student that could be affected
          let invQ = supabase
            .from('fee_invoices')
            .select('id, billing_month, amount, currency, period_from, period_to, plan_id, assignment_id, status')
            .eq('student_id', assignment.student_id)
            .eq('status', 'pending')
            .gte('period_to', effDate);
          const { data: candidateInvs } = await invQ;

          const targets = (candidateInvs || []).filter((inv: any) => {
            if (inv.assignment_id === id) return true;
            if (inv.plan_id && planIds.includes(inv.plan_id)) return true;
            // If the assignment is the student's ONLY active assignment, fallback-attribute the invoice
            return false;
          });

          // Also include invoices that match planIds but had assignment_id null
          for (const inv of targets) {
            const periodFrom = new Date(inv.period_from);
            const effective = new Date(effDate);
            if (periodFrom >= effective) {
              // Entire period is after the leave date → waive (zero out)
              await supabase.from('fee_invoices').update({
                amount: 0,
                status: 'waived',
                remark: `Auto-waived: assignment marked ${status} eff. ${effDate}`,
                updated_at: new Date().toISOString(),
              }).eq('id', inv.id);
            } else {
              // Period straddles the leave date → reprorate to active days only
              const periodTo = new Date(inv.period_to);
              const monthFirst = new Date(periodFrom.getFullYear(), periodFrom.getMonth(), 1);
              const monthLast = new Date(periodFrom.getFullYear(), periodFrom.getMonth() + 1, 0);
              const daysInMonth = monthLast.getDate();
              const fullMonthRate = (inv.amount * daysInMonth) / (Math.floor((periodTo.getTime() - periodFrom.getTime()) / 86400000) + 1);
              const newTo = new Date(effective.getTime() - 86400000); // day before leave date
              if (newTo < periodFrom) continue;
              const activeDays = Math.floor((newTo.getTime() - periodFrom.getTime()) / 86400000) + 1;
              const newAmount = Math.round((fullMonthRate / daysInMonth) * activeDays * 100) / 100;
              await supabase.from('fee_invoices').update({
                amount: newAmount,
                period_to: newTo.toISOString().slice(0, 10),
                remark: `Reprorated: assignment ${status} eff. ${effDate}`,
                updated_at: new Date().toISOString(),
              }).eq('id', inv.id);
            }
          }
        }
      } else if (status === 'active' && (fromStatus === 'on_hold' || fromStatus === 'completed')) {
        await supabase.from('student_billing_plans')
          .update({
            is_active: true,
            change_reason: `Assignment resumed to active${effectiveDate ? ` effective ${effectiveDate}` : ''}`,
            updated_at: new Date().toISOString(),
          })
          .eq('assignment_id', id);
      }

      // Left → clear future schedules and close history
      if (status === 'left') {
        await supabase.from('schedules').delete().eq('assignment_id', id);
        await supabase
          .from('assignment_history')
          .update({ ended_at: effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString() })
          .eq('assignment_id', id)
          .is('ended_at', null);

        // Archive the student profile if they have NO other non-terminal assignment
        if (assignment) {
          const { data: studentAssigns } = await supabase
            .from('student_teacher_assignments')
            .select('id, status')
            .eq('student_id', assignment.student_id);
          if (shouldArchiveOnLeft((studentAssigns as any) || [], id)) {
            await supabase
              .from('profiles')
              .update({ archived_at: new Date().toISOString() })
              .eq('id', assignment.student_id);
            await trackActivity({
              action: 'profile_archived',
              entityType: 'user',
              entityId: assignment.student_id,
              details: { reason: reason || 'Marked as Left', via: 'assignment_status_change' },
            });
          }
        }
      }

      // Audit log
      await trackActivity({
        action: 'assignment_status_changed',
        entityType: 'assignment',
        entityId: id,
        details: {
          student_name: assignment?.student_name,
          teacher_name: assignment?.teacher_name,
          from_status: fromStatus,
          to_status: status,
          reason: reason || null,
          effective_date: effectiveDate || null,
        },
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      const rule = getStatusRule(status);
      toast({
        title: 'Status updated',
        description: status === 'left'
          ? 'Marked as Left. Schedules cleared, profile archived if no other active assignments.'
          : `${rule.label} — ${rule.description}`,
      });
      setStatusChangeDialog(null);
      setStatusChangeReason('');
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });

  // Reassign teacher mutation - supports Permanent and Temporary (Substitute)
  const reassignMutation = useMutation({
    mutationFn: async ({
      id, newTeacherId, reason, payoutAmount: pa, payoutType: pt, effectiveDate,
      transferType, substituteEndDate,
    }: {
      id: string; newTeacherId: string; reason?: string;
      payoutAmount?: number; payoutType?: string; effectiveDate?: string;
      transferType: 'permanent' | 'substitute'; substituteEndDate?: string;
    }) => {
      const sb = supabase as any;
      const assignment = assignments.find(a => a.id === id);
      if (!assignment) throw new Error('Assignment not found');
      const effDate = effectiveDate || new Date().toISOString().split('T')[0];

      const { data: currentAssign, error: currentErr } = await sb
        .from('student_teacher_assignments')
        .select('id, student_id, teacher_id, subject_id, branch_id, division_id, duration_minutes, fee_package_id, requires_schedule, requires_planning, requires_attendance, transfer_type, parent_assignment_id')
        .eq('id', id)
        .single();
      if (currentErr) throw currentErr;
      const payoutLookup = await fetchAssignmentPayouts([id, currentAssign?.parent_assignment_id]);
      const currentPayout = payoutLookup.get(id) || { payout_amount: null, payout_type: null };
      const parentPayout = currentAssign?.parent_assignment_id
        ? payoutLookup.get(currentAssign.parent_assignment_id) || { payout_amount: null, payout_type: null }
        : { payout_amount: null, payout_type: null };

      const { data: parentAssign, error: parentErr } = currentAssign?.parent_assignment_id
        ? await sb
            .from('student_teacher_assignments')
            .select('id, student_id, teacher_id, subject_id, branch_id, division_id, duration_minutes, fee_package_id, requires_schedule, requires_planning, requires_attendance, transfer_type, parent_assignment_id')
            .eq('id', currentAssign.parent_assignment_id)
            .single()
        : { data: null, error: null };
      if (parentErr) throw parentErr;

      const isSubstituteAssignment = currentAssign?.transfer_type === 'substitute' && !!currentAssign?.parent_assignment_id;
      const isReturnToOriginal = isSubstituteAssignment && !!parentAssign && newTeacherId === parentAssign.teacher_id;

      if (isReturnToOriginal && parentAssign) {
        await sb.from('assignment_history')
          .update({ ended_at: new Date(effDate).toISOString(), reason: reason || 'Substitute ended, original teacher resumed' })
          .eq('assignment_id', id)
          .is('ended_at', null);

        const { error: subCompleteErr } = await sb.from('student_teacher_assignments')
          .update({
            status: 'completed',
            effective_to_date: effDate,
            status_effective_date: effDate,
            status_change_reason: reason || 'Returned to original teacher',
          })
          .eq('id', id);
        if (subCompleteErr) throw subCompleteErr;

        const { error: parentResumeErr } = await sb.from('student_teacher_assignments')
          .update({
            status: 'active',
            effective_to_date: null,
            status_effective_date: effDate,
            status_change_reason: reason || 'Resumed after temporary substitute',
          })
          .eq('id', parentAssign.id);
        if (parentResumeErr) throw parentResumeErr;

        await sb.from('schedules')
          .update({ is_active: false })
          .eq('assignment_id', id);

        await sb.from('schedules')
          .update({ is_active: true })
          .eq('assignment_id', parentAssign.id);

        return { mode: 'restored_original' as const };
      }

      if (transferType === 'permanent') {
        // PERMANENT TRANSFER — never overwrite teacher_id on the existing row.
        // Doing so would orphan all attendance / salary / history records that
        // reference assignment_id. Instead: close the old assignment and
        // create a brand-new assignment row for the new teacher.

        // 1. Close out the open history entry for the previous teacher
        await sb.from('assignment_history')
          .update({ ended_at: new Date(effDate).toISOString(), reason: reason || 'Permanent transfer' })
          .eq('assignment_id', id)
          .is('ended_at', null);

        // 2. Mark the OLD assignment as completed (preserve teacher_id, attendance, salary)
        const { error: oldErr } = await sb.from('student_teacher_assignments')
          .update({
            status: 'completed',
            effective_to_date: effDate,
            status_effective_date: effDate,
            status_change_reason: reason || 'Permanent transfer',
          })
          .eq('id', id);
        if (oldErr) throw oldErr;

        if (isSubstituteAssignment && parentAssign) {
          await sb.from('assignment_history')
            .update({ ended_at: new Date(effDate).toISOString(), reason: reason || 'Temporary substitute converted to permanent transfer' })
            .eq('assignment_id', parentAssign.id)
            .is('ended_at', null);

          const { error: parentCloseErr } = await sb.from('student_teacher_assignments')
            .update({
              status: 'completed',
              effective_to_date: effDate,
              status_effective_date: effDate,
              status_change_reason: reason || 'Superseded after substitute period',
            })
            .eq('id', parentAssign.id);
          if (parentCloseErr) throw parentCloseErr;
        }

        // 3. Pull the full original row to clone into the new assignment
        const oldAssign = currentAssign;

        // 4. Create the NEW assignment row for the new teacher
        const { data: newAssign, error: newErr } = await sb
          .from('student_teacher_assignments')
          .insert({
            student_id: assignment.student_id,
            teacher_id: newTeacherId,
            subject_id: oldAssign?.subject_id ?? assignment.subject_id,
            branch_id: oldAssign?.branch_id ?? activeDivision?.branch_id ?? null,
            division_id: oldAssign?.division_id ?? activeDivision?.id ?? null,
            duration_minutes: oldAssign?.duration_minutes ?? null,
            payout_amount: pa && pa > 0 ? pa : (currentPayout.payout_amount ?? assignment.payout_amount),
            payout_type: pt || currentPayout.payout_type || assignment.payout_type,
            fee_package_id: oldAssign?.fee_package_id ?? null,
            status: 'active',
            effective_from_date: effDate,
            transfer_type: 'permanent',
            requires_schedule: oldAssign?.requires_schedule ?? true,
            requires_planning: oldAssign?.requires_planning ?? true,
            requires_attendance: oldAssign?.requires_attendance ?? true,
          })
          .select('id')
          .single();
        if (newErr) throw newErr;

        // 5. Open a fresh history entry for the new teacher on the new assignment
        if (newAssign) {
          await sb.from('assignment_history').insert({
            assignment_id: newAssign.id,
            teacher_id: newTeacherId,
            student_id: assignment.student_id,
            subject_id: oldAssign?.subject_id ?? assignment.subject_id,
            started_at: new Date(effDate).toISOString(),
            reason: reason || 'Permanent transfer',
          });
        }
        return { mode: 'permanent' as const };
      } else {
        // SUBSTITUTE: pause original, create child substitute assignment
        if (!substituteEndDate) throw new Error('Substitute end date is required');

        const baseAssign = parentAssign ?? currentAssign;
        const parentAssignmentId = parentAssign?.id ?? currentAssign.id;
        const scheduleSourceAssignmentId = isSubstituteAssignment ? currentAssign.id : parentAssignmentId;

        if (isSubstituteAssignment) {
          await sb.from('assignment_history')
            .update({ ended_at: new Date(effDate).toISOString(), reason: reason || 'Temporary substitute replaced' })
            .eq('assignment_id', id)
            .is('ended_at', null);

          const { error: currentSubErr } = await sb.from('student_teacher_assignments')
            .update({
              status: 'completed',
              effective_to_date: effDate,
              status_effective_date: effDate,
              status_change_reason: reason || 'Replaced by another substitute',
            })
            .eq('id', id);
          if (currentSubErr) throw currentSubErr;

          const { error: parentHoldErr } = await sb.from('student_teacher_assignments')
            .update({
              status: 'on_hold',
              status_effective_date: effDate,
              status_change_reason: reason || 'Temporary substitute updated',
            })
            .eq('id', parentAssignmentId);
          if (parentHoldErr) throw parentHoldErr;
        } else {
          const { error: holdErr } = await sb.from('student_teacher_assignments')
            .update({
              status: 'on_hold',
              status_effective_date: effDate,
              status_change_reason: reason || 'Temporary substitute assigned',
            })
            .eq('id', id);
          if (holdErr) throw holdErr;
        }

        const { data: subAssign } = await sb
          .from('student_teacher_assignments')
          .insert({
            student_id: assignment.student_id,
            teacher_id: newTeacherId,
            subject_id: baseAssign?.subject_id ?? assignment.subject_id,
            branch_id: baseAssign?.branch_id ?? activeDivision?.branch_id ?? null,
            division_id: baseAssign?.division_id ?? activeDivision?.id ?? null,
            duration_minutes: baseAssign?.duration_minutes ?? null,
            payout_amount: pa && pa > 0 ? pa : (parentPayout.payout_amount ?? currentPayout.payout_amount ?? assignment.payout_amount),
            payout_type: pt || parentPayout.payout_type || currentPayout.payout_type || assignment.payout_type,
            fee_package_id: baseAssign?.fee_package_id ?? null,
            status: 'active',
            effective_from_date: effDate,
            effective_to_date: substituteEndDate,
            transfer_type: 'substitute',
            parent_assignment_id: parentAssignmentId,
            substitute_end_date: substituteEndDate,
            requires_schedule: baseAssign?.requires_schedule ?? true,
            requires_planning: baseAssign?.requires_planning ?? true,
            requires_attendance: baseAssign?.requires_attendance ?? true,
          })
          .select('id')
          .single();

        if (subAssign) {
          const { data: parentSchedules } = await sb
            .from('schedules')
            .select('day_of_week, student_local_time, teacher_local_time, duration_minutes, division_id')
            .eq('assignment_id', scheduleSourceAssignmentId)
            .eq('is_active', true);

          if (parentSchedules?.length) {
            await sb.from('schedules')
              .update({ is_active: false })
              .eq('assignment_id', scheduleSourceAssignmentId);

            await sb.from('schedules').insert(
              parentSchedules.map((schedule: any) => ({
                assignment_id: subAssign.id,
                division_id: schedule.division_id ?? baseAssign?.division_id ?? activeDivision?.id ?? null,
                day_of_week: schedule.day_of_week,
                student_local_time: schedule.student_local_time,
                teacher_local_time: schedule.teacher_local_time,
                duration_minutes: schedule.duration_minutes,
              }))
            );
          }

          await sb.from('assignment_history').insert({
            assignment_id: subAssign.id,
            student_id: assignment.student_id,
            teacher_id: newTeacherId,
            subject_id: baseAssign?.subject_id ?? assignment.subject_id,
            started_at: new Date(effDate).toISOString(),
            reason: reason || `Temporary substitute until ${substituteEndDate}`,
          });
        }
        return { mode: 'substitute' as const };
      }
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({
        title: result?.mode === 'restored_original'
          ? 'Original Teacher Restored'
          : vars.transferType === 'permanent'
            ? 'Permanently Reassigned'
            : 'Substitute Assigned',
        description: result?.mode === 'restored_original'
          ? 'Temporary substitute closed and the original assignment was resumed with its existing schedule and history.'
          : vars.transferType === 'permanent'
            ? 'Teacher reassigned. History recorded.'
            : 'Original teacher remains on hold while the substitute period is active.',
      });
      setReassignDialog(null);
      setReassignTeacherId('');
      setReassignReason('');
      setReassignPayoutAmount('');
      setReassignPayoutType('monthly');
      setReassignEffectiveDate('');
      setReassignTransferType('permanent');
      setReassignSubstituteEndDate('');
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });

  const resetForm = () => {
    setSelectedTeacher('');
    setSelectedStudents([]);
    setSelectedSubject('');
    setPayoutAmount('');
    setPayoutType('monthly');
    setEffectiveFromDate('');
    setEffectiveToDate('');
    setEditingAssignment(null);
    setChangeType('payout');
    setCloseReason('');
    setInfoRequiresSchedule(true);
    setInfoRequiresPlanning(true);
    setInfoRequiresAttendance(true);
    setInfoNotes('');
    setCloseStatus('completed');
    setVoidPendingInvoices(false);
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setChangeType('payout');
    setSelectedTeacher(assignment.teacher_id);
    setSelectedSubject(assignment.subject_id || '');
    setSelectedStudents([assignment.student_id]);
    setPayoutAmount(assignment.payout_amount?.toString() || '');
    setPayoutType(assignment.payout_type || 'monthly');
    // Default Effective From to first day of NEXT month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setEffectiveFromDate(nextMonth.toISOString().split('T')[0]);
    setEffectiveToDate('');
    setCloseReason('');
    setInfoRequiresSchedule(assignment.requires_schedule);
    setInfoRequiresPlanning(assignment.requires_planning);
    setInfoRequiresAttendance(assignment.requires_attendance);
    setInfoNotes('');
    setCloseStatus('completed');
    setVoidPendingInvoices(false);
    setIsFormOpen(true);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const runUpdateSave = () => {
    if (!editingAssignment) return;
    updateMutation.mutate({
      id: editingAssignment.id,
      teacherId: selectedTeacher,
      subjectId: selectedSubject || undefined,
    });
  };

  const handleSubmit = async () => {
    if (editingAssignment) {
      if (changeType === 'payout') {
        if (!payoutAmount || !effectiveFromDate) {
          toast({ title: 'Missing fields', description: 'Payout amount and Effective From are required', variant: 'destructive' });
          return;
        }
      }
      if (changeType === 'close') {
        if (!effectiveToDate) {
          toast({ title: 'Missing end date', description: 'Select an End Date', variant: 'destructive' });
          return;
        }
      }
      runUpdateSave();
      return;
    }

    // Create path
    if (!selectedTeacher || selectedStudents.length === 0) {
      toast({ title: 'Error', description: 'Select a teacher and at least one student', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      teacherId: selectedTeacher,
      studentIds: selectedStudents,
      subjectId: selectedSubject || undefined,
    });
  };


  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = loadingTeachers || loadingStudents || loadingAssignments;

  // Filter and sort
  const filteredAssignments = useMemo(() => {
    let result = assignments.filter(a =>
      statusFilter === 'all' ? true : a.status === statusFilter
    );
    if (teacherFilter !== 'all') result = result.filter(a => a.teacher_id === teacherFilter);
    if (subjectFilter !== 'all') result = result.filter(a => (a.subject_id || 'none') === subjectFilter);
    if (payoutTypeFilter !== 'all') result = result.filter(a => (a.payout_type || 'monthly') === payoutTypeFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.teacher_name.toLowerCase().includes(term) ||
        a.student_name.toLowerCase().includes(term) ||
        (a.subject_name?.toLowerCase().includes(term) ?? false)
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      let av: any = a[sortKey as keyof Assignment];
      let bv: any = b[sortKey as keyof Assignment];
      if (sortKey === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      if (sortKey === 'payout_amount') return ((a.payout_amount || 0) - (b.payout_amount || 0)) * dir;
      av = (av ?? '').toString().toLowerCase();
      bv = (bv ?? '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
    return result;
  }, [assignments, statusFilter, teacherFilter, subjectFilter, payoutTypeFilter, searchTerm, sortKey, sortDir]);

  const statusCounts = {
    active: assignments.filter(a => a.status === 'active').length,
    on_hold: assignments.filter(a => a.status === 'on_hold').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    left: assignments.filter(a => a.status === 'left').length,
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const resetToolbar = () => {
    setSearchTerm('');
    setSortKey('created_at');
    setSortDir('desc');
    setStatusFilter('active');
    setTeacherFilter('all');
    setSubjectFilter('all');
    setPayoutTypeFilter('all');
  };

  const exportAssignments = () => {
    if (filteredAssignments.length === 0) {
      toast({ title: 'Nothing to export', description: 'No assignments match current filters.', variant: 'destructive' });
      return;
    }
    const headers = ['Student', 'Teacher', 'Subject', 'Status', 'Payout Amount', 'Payout Type', 'Effective From', 'Created'];
    const rows = filteredAssignments.map(a => [
      a.student_name,
      a.teacher_name,
      a.subject_name || '',
      a.status,
      a.payout_amount,
      a.payout_type,
      a.effective_from_date || '',
      a.created_at ? formatDisplayDate(a.created_at) : '',
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignments_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${filteredAssignments.length} assignments` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Student–Teacher Assignment</h1>
            <p className="text-muted-foreground mt-1">Academic assignments & teacher payout configuration</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportAssignments} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsBulkImportOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Assignment
            </Button>
          </div>
        </div>

        <BulkAssignmentImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />

        {/* Stats Cards on Top */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Teachers</p>
                  <p className="text-2xl font-bold">{teachers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Assignments</p>
                  <p className="text-2xl font-bold">{statusCounts.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Summary */}
        {(statusCounts.on_hold > 0 || statusCounts.completed > 0) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {statusCounts.on_hold > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {statusCounts.on_hold} on hold
              </span>
            )}
            {statusCounts.completed > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {statusCounts.completed} completed
              </span>
            )}
          </div>
        )}

        {/* Create / Edit Assignment Dialog */}
        <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsFormOpen(true); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
              </DialogTitle>
              <DialogDescription>
                {editingAssignment
                  ? 'Pick what you want to change. Each action only touches its own data scope.'
                  : 'Assign a teacher to one or more students with payout configuration.'}
              </DialogDescription>
            </DialogHeader>

            {editingAssignment ? (
              <div className="space-y-4 py-2">
                {/* Step 1 — Change Type cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { key: 'payout', label: 'Update Payout', desc: 'Change payout amount or type. Takes effect from a new date forward.', Icon: DollarSign },
                    { key: 'info', label: 'Correct Information', desc: 'Fix subject or admin flags. No financial or date impact.', Icon: Pencil },
                    { key: 'close', label: 'Close Assignment', desc: 'End this assignment. Sets a closing date and locks the record.', Icon: XCircle },
                  ] as { key: ChangeType; label: string; desc: string; Icon: typeof Pencil }[]).map(opt => {
                    const active = changeType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setChangeType(opt.key)}
                        className={cn(
                          'rounded-lg border-2 p-3 text-left transition-all',
                          active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <opt.Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                          <p className="text-sm font-bold">{opt.label}</p>
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Step 2 — Static, non-editable context */}
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-normal">Teacher: <span className="font-medium ml-1">{editingAssignment.teacher_name}</span></Badge>
                    <Badge variant="outline" className="font-normal">
                      Student: <span className="font-medium ml-1">{editingAssignment.student_name}</span>
                      {(students.find(s => s.id === editingAssignment.student_id) as any)?.registration_id && (
                        <span className="ml-1 font-mono text-muted-foreground">({(students.find(s => s.id === editingAssignment.student_id) as any).registration_id})</span>
                      )}
                    </Badge>
                    {editingAssignment.subject_name && (
                      <Badge variant="outline" className="font-normal">Subject: <span className="font-medium ml-1">{editingAssignment.subject_name}</span></Badge>
                    )}
                  </div>
                </div>

                {/* Step 3 — Dynamic fields */}
                {changeType === 'payout' && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-200">
                      Creates a new payout version from the <strong>Effective From</strong> date. Past salary records remain unchanged.
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Banknote className="h-4 w-4" /> Payout
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Payout Amount *</Label>
                        <Input type="number" placeholder="0" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Payout Type</Label>
                        <Select value={payoutType} onValueChange={setPayoutType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="per_class">Per Class</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Effective From *</Label>
                      <Input
                        type="date"
                        value={effectiveFromDate}
                        onChange={(e) => setEffectiveFromDate(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Back-dating allowed. Paid/locked salary months are protected automatically.</p>
                    </div>
                  </div>
                )}

                {changeType === 'info' && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900/50 p-3 text-xs text-blue-800 dark:text-blue-200">
                      Cosmetic corrections only. Subject, admin flags, and notes. No financial impact.
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Subject</Label>
                      <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger><SelectValue placeholder="Choose a subject..." /></SelectTrigger>
                        <SelectContent>
                          {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-md border border-border p-3 space-y-2">
                      <p className="text-xs font-semibold">Admin Flags</p>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="req-sched" className="text-xs">Requires Schedule</Label>
                        <Switch id="req-sched" checked={infoRequiresSchedule} onCheckedChange={setInfoRequiresSchedule} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="req-plan" className="text-xs">Requires Planning</Label>
                        <Switch id="req-plan" checked={infoRequiresPlanning} onCheckedChange={setInfoRequiresPlanning} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="req-att" className="text-xs">Requires Attendance</Label>
                        <Switch id="req-att" checked={infoRequiresAttendance} onCheckedChange={setInfoRequiresAttendance} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes (optional)</Label>
                      <Textarea value={infoNotes} onChange={(e) => setInfoNotes(e.target.value)} rows={2} placeholder="What was corrected and why…" />
                    </div>
                  </div>
                )}

                {changeType === 'close' && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      Ends the assignment. Student will no longer appear in the active roster.
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Status *</Label>
                        <Select value={closeStatus} onValueChange={(v) => setCloseStatus(v as 'completed' | 'left')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Date *</Label>
                        <Input
                          type="date"
                          value={effectiveToDate}
                          onChange={(e) => setEffectiveToDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reason (optional)</Label>
                      <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} rows={2} placeholder="e.g. Course completed, family relocated…" />
                    </div>
                    {effectiveToDate && pendingInvoicesAfterClose.length > 0 && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 space-y-2">
                        <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <p>
                            <strong>{pendingInvoicesAfterClose.length}</strong> pending invoice
                            {pendingInvoicesAfterClose.length === 1 ? ' is' : 's are'} scheduled after this end date.
                          </p>
                        </div>
                        <div className="flex items-center justify-between pl-6">
                          <Label htmlFor="void-toggle" className="text-xs">Void those pending invoices</Label>
                          <Switch id="void-toggle" checked={voidPendingInvoices} onCheckedChange={setVoidPendingInvoices} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Select Teacher *</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Choose a teacher..." /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger><SelectValue placeholder="Choose a subject..." /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Students *</Label>
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                    {students.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">No students found</p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {students.map((student) => (
                          <label key={student.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer">
                            <Checkbox
                              checked={selectedStudents.includes(student.id)}
                              onCheckedChange={() => handleStudentToggle(student.id)}
                            />
                            <span className="text-sm">
                              {student.full_name}
                              {(student as any).registration_id && (
                                <span className="ml-2 text-xs text-muted-foreground font-mono">({(student as any).registration_id})</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedStudents.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedStudents.length} student(s) selected</p>
                  )}
                </div>

                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Banknote className="h-4 w-4" />
                    Teacher Payout
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Payout Amount</Label>
                      <Input type="number" placeholder="0" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Payout Type</Label>
                      <Select value={payoutType} onValueChange={setPayoutType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="per_class">Per Class</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Effective From</Label>
                      <Input type="date" value={effectiveFromDate} onChange={(e) => setEffectiveFromDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Effective To</Label>
                      <Input type="date" value={effectiveToDate} onChange={(e) => setEffectiveToDate(e.target.value)} min={effectiveFromDate || undefined} />
                      <p className="text-[10px] text-muted-foreground">Leave blank for ongoing.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  (!editingAssignment && (!selectedTeacher || selectedStudents.length === 0))
                }
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAssignment ? 'Save Change' : 'Save Assignment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Locked salary confirm modal */}
        <Dialog open={!!lockedConfirm} onOpenChange={(o) => { if (!o) setLockedConfirm(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Past salary records are locked</DialogTitle>
              <DialogDescription>
                {lockedConfirm?.count} salary record(s) for this teacher are paid or locked. This change will only apply from{' '}
                <strong>{lockedConfirm?.effectiveDate}</strong> onward. Historical records will remain untouched.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLockedConfirm(null)}>Cancel</Button>
              <Button onClick={() => lockedConfirm?.onConfirm()}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Assignments Table */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Assignments ({filteredAssignments.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetToolbar} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Reset filters
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <Input
                placeholder="Search name or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssignmentStatus | 'all')}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active ({statusCounts.active})</SelectItem>
                  <SelectItem value="on_hold">On Hold ({statusCounts.on_hold})</SelectItem>
                  <SelectItem value="completed">Completed ({statusCounts.completed})</SelectItem>
                  <SelectItem value="left">Left ({statusCounts.left})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="none">No Subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={payoutTypeFilter} onValueChange={setPayoutTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Payout Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payout Types</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="per_class">Per Class</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No {statusFilter !== 'all' ? statusFilter : ''} assignments found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('teacher_name')}>Teacher<SortIcon k="teacher_name" /></TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('student_name')}>Student<SortIcon k="student_name" /></TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('subject_name')}>Subject<SortIcon k="subject_name" /></TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('payout_amount')}>Payout<SortIcon k="payout_amount" /></TableHead>
                    <TableHead>Billing Plan</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Status<SortIcon k="status" /></TableHead>
                    <TableHead className="text-center">Reassign</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => {
                    const linkedPlan = plansByAssignment[assignment.id];
                    return (
                      <TableRow key={assignment.id} className={assignment.status !== 'active' ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{assignment.teacher_name}</TableCell>
                        <TableCell>{assignment.student_name}</TableCell>
                        <TableCell>
                          {assignment.subject_name ? (
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-3 w-3 text-muted-foreground" />
                              {assignment.subject_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.payout_amount > 0 ? (
                            <span className="text-sm font-mono">
                              {assignment.payout_amount.toLocaleString()}
                              <span className="text-xs text-muted-foreground ml-1">
                                /{assignment.payout_type === 'per_class' ? 'class' : 'mo'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {linkedPlan ? (
                            <Badge
                              variant="outline"
                              className="cursor-pointer text-xs"
                              onClick={() => setBillingDetailAssignmentId(assignment.id)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {linkedPlan.fee_packages?.name || 'Plan'}
                              {!linkedPlan.is_active && ' (Inactive)'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No plan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {[
                              { key: 'requires_schedule' as const, label: 'S', title: 'Schedule Tracking', activeClass: 'bg-teal text-white shadow-sm', inactiveClass: 'bg-muted/60 text-muted-foreground/50' },
                              { key: 'requires_planning' as const, label: 'P', title: 'Planning Tracking', activeClass: 'bg-gold text-white shadow-sm', inactiveClass: 'bg-muted/60 text-muted-foreground/50' },
                              { key: 'requires_attendance' as const, label: 'A', title: 'Attendance Tracking', activeClass: 'bg-sky-500 text-white shadow-sm', inactiveClass: 'bg-muted/60 text-muted-foreground/50' },
                            ].map(({ key, label, title, activeClass, inactiveClass }) => (
                              <button
                                key={key}
                                title={`${title}: ${assignment[key] ? 'ON — click to disable' : 'OFF — click to enable'}`}
                                className={cn(
                                  'w-7 h-7 rounded-md text-xs font-extrabold flex items-center justify-center cursor-pointer transition-all duration-200 border',
                                  assignment[key]
                                    ? `${activeClass} border-transparent hover:opacity-80`
                                    : `${inactiveClass} border-border hover:bg-muted`
                                )}
                                onClick={async () => {
                                  await supabase.from('student_teacher_assignments').update({ [key]: !assignment[key] }).eq('id', assignment.id);
                                  queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
                                  toast({
                                    title: `${title} ${!assignment[key] ? 'Enabled' : 'Disabled'}`,
                                    description: `${assignment.student_name} — ${title.toLowerCase()} is now ${!assignment[key] ? 'on' : 'off'}`,
                                  });
                                }}
                              >{label}</button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={assignment.status}
                            onValueChange={(value: AssignmentStatus) => {
                              if (value === assignment.status) return;
                              const rule = getStatusRule(value);
                              if (rule.requiresConfirmation) {
                                setStatusChangeDialog({ assignment, newStatus: value });
                                setStatusEffectiveDate(new Date().toISOString().split('T')[0]);
                                setStatusChangeReason('');
                              } else {
                                updateStatusMutation.mutate({ id: assignment.id, status: value });
                              }
                            }}
                            disabled={updateStatusMutation.isPending}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SelectTrigger className="w-[130px] h-8">
                                  <span className="flex items-center gap-2 truncate">
                                    <span className={cn('h-2 w-2 rounded-full shrink-0', getStatusRule(assignment.status).dotClass)} />
                                    <span className="truncate">{getStatusRule(assignment.status).label}</span>
                                  </span>
                                </SelectTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                {getStatusRule(assignment.status).description}
                              </TooltipContent>
                            </Tooltip>
                            <SelectContent className="w-[280px]">
                              {(Object.keys(ASSIGNMENT_STATUS_RULES) as AssignmentStatus[]).map((key) => {
                                const r = ASSIGNMENT_STATUS_RULES[key];
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex flex-col items-start gap-0.5 py-0.5">
                                      <span className="flex items-center gap-2 font-medium">
                                        <span className={cn('h-2 w-2 rounded-full', r.dotClass)} />
                                        {r.label}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground leading-tight">{r.description}</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReassignDialog(assignment);
                              setReassignTeacherId('');
                              setReassignReason('');
                              setReassignPayoutAmount(assignment.payout_amount?.toString() || '');
                              setReassignPayoutType(assignment.payout_type || 'monthly');
                              setReassignEffectiveDate(new Date().toISOString().split('T')[0]);
                              setReassignTransferType('permanent');
                              setReassignSubstituteEndDate('');
                            }}
                            title="Reassign teacher"
                          >
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const isClosed = assignment.status === 'completed' || assignment.status === 'left';
                            const lockedMonth = lockedTeacherMonth[assignment.teacher_id];
                            return (
                              <div className="flex items-center justify-center gap-1">
                                {lockedMonth && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                                    </TooltipTrigger>
                                    <TooltipContent>Salary locked through {lockedMonth}</TooltipContent>
                                  </Tooltip>
                                )}
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailAssignmentId(assignment.id); }} title="View details">
                                  <Eye className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); setHistoryAssignmentId(assignment.id); }}
                                  title="View history"
                                >
                                  <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {isClosed ? (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    Closed {assignment.effective_to_date ? `on ${formatDisplayDate(assignment.effective_to_date)}` : ''}
                                  </Badge>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditAssignment(assignment); }} title="Edit">
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(assignment.id); }} disabled={deleteMutation.isPending} title="Delete">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Teacher Reassignment Dialog */}
        <Dialog open={!!reassignDialog} onOpenChange={(open) => { if (!open) { setReassignDialog(null); setReassignTeacherId(''); setReassignReason(''); setReassignPayoutAmount(''); setReassignPayoutType('monthly'); setReassignEffectiveDate(''); setReassignTransferType('permanent'); setReassignSubstituteEndDate(''); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Reassign Teacher</DialogTitle>
              <DialogDescription>
                Change the teacher for <strong>{reassignDialog?.student_name}</strong>'s assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Transfer type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Transfer Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReassignTransferType('permanent')}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      reassignTransferType === 'permanent' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="text-sm font-bold">Permanent</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Old assignment closes. New teacher takes over.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReassignTransferType('substitute')}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      reassignTransferType === 'substitute' ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-amber-500/40'
                    }`}
                  >
                    <p className="text-sm font-bold">Temporary</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">On hold. Auto-reverts after end date.</p>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Current Teacher</Label>
                <p className="text-sm font-medium text-muted-foreground">{reassignDialog?.teacher_name}</p>
              </div>
              <div className="space-y-2">
                <Label>New Teacher *</Label>
                <Select value={reassignTeacherId} onValueChange={setReassignTeacherId}>
                  <SelectTrigger><SelectValue placeholder="Select new teacher..." /></SelectTrigger>
                  <SelectContent>
                    {teachers
                      .filter(t => t.id !== reassignDialog?.teacher_id)
                      .map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Banknote className="h-4 w-4" />
                  New Teacher Payout Details
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Payout Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={reassignPayoutAmount}
                      onChange={(e) => setReassignPayoutAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payout Type</Label>
                    <Select value={reassignPayoutType} onValueChange={setReassignPayoutType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="per_class">Per Class</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={`grid gap-3 ${reassignTransferType === 'substitute' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-1">
                    <Label className="text-xs">Effective From {reassignTransferType === 'substitute' ? '*' : ''}</Label>
                    <Input
                      type="date"
                      value={reassignEffectiveDate}
                      onChange={(e) => setReassignEffectiveDate(e.target.value)}
                    />
                  </div>
                  {reassignTransferType === 'substitute' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Substitute Until *</Label>
                      <Input
                        type="date"
                        value={reassignSubstituteEndDate}
                        onChange={(e) => setReassignSubstituteEndDate(e.target.value)}
                        min={reassignEffectiveDate || undefined}
                      />
                    </div>
                  )}
                </div>
                {reassignTransferType === 'substitute' && (
                  <p className="text-[11px] text-muted-foreground">Original teacher's assignment will auto-resume after this date.</p>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Reason for Reassignment</Label>
                <Textarea
                  placeholder="Optional reason..."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReassignDialog(null); setReassignTeacherId(''); setReassignReason(''); setReassignPayoutAmount(''); setReassignPayoutType('monthly'); setReassignEffectiveDate(''); setReassignTransferType('permanent'); setReassignSubstituteEndDate(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (reassignDialog && reassignTeacherId) {
                    if (reassignTransferType === 'substitute' && !reassignSubstituteEndDate) {
                      toast({ title: 'Missing date', description: 'Substitute end date is required.', variant: 'destructive' });
                      return;
                    }
                    reassignMutation.mutate({
                      id: reassignDialog.id,
                      newTeacherId: reassignTeacherId,
                      reason: reassignReason,
                      payoutAmount: parseFloat(reassignPayoutAmount) || 0,
                      payoutType: reassignPayoutType,
                      effectiveDate: reassignEffectiveDate || undefined,
                      transferType: reassignTransferType,
                      substituteEndDate: reassignSubstituteEndDate || undefined,
                    });
                  }
                }}
                disabled={!reassignTeacherId || reassignMutation.isPending || (reassignTransferType === 'substitute' && !reassignSubstituteEndDate)}
                className={reassignTransferType === 'substitute' ? 'bg-amber-500 hover:bg-amber-600' : ''}
              >
                {reassignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {reassignTransferType === 'permanent' ? 'Transfer Permanently' : 'Assign Substitute'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Change Confirmation Dialog */}
        <Dialog open={!!statusChangeDialog} onOpenChange={(open) => { if (!open) { setStatusChangeDialog(null); setStatusChangeReason(''); } }}>
          <DialogContent className="sm:max-w-md">
            {statusChangeDialog && (() => {
              const rule = getStatusRule(statusChangeDialog.newStatus);
              const isLeft = statusChangeDialog.newStatus === 'left';
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', rule.dotClass)} />
                      {isLeft ? '⚠️ ' : ''}Switch to {rule.label}?
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                      <strong>{statusChangeDialog.assignment.student_name}</strong> with{' '}
                      <strong>{statusChangeDialog.assignment.teacher_name}</strong>
                      <span className="block mt-2 text-foreground">{rule.description}.</span>
                      {isLeft && (
                        <span className="block mt-2 text-amber-700 dark:text-amber-400 text-xs">
                          The student profile will be archived if no other active assignments remain.
                          All historical attendance, invoices and salary data are preserved.
                          Reversible by restoring the profile from User Management.
                        </span>
                      )}
                      {statusChangeDialog.newStatus === 'completed' && (
                        <span className="block mt-2 text-xs text-muted-foreground">
                          No future invoices or attendance. Salary history retained.
                        </span>
                      )}
                      {statusChangeDialog.newStatus === 'on_hold' && (
                        <span className="block mt-2 text-xs text-muted-foreground">
                          Invoice and salary generation will stop from next cycle.
                          Pending invoices already generated are not deleted — review manually.
                        </span>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Effective Date *</Label>
                      <Input
                        type="date"
                        value={statusEffectiveDate}
                        onChange={(e) => setStatusEffectiveDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason *</Label>
                      <Textarea
                        value={statusChangeReason}
                        onChange={(e) => setStatusChangeReason(e.target.value)}
                        placeholder="Why is this status changing? (recorded for audit)"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setStatusChangeDialog(null); setStatusChangeReason(''); }}>Cancel</Button>
                    <Button
                      variant={isLeft ? 'destructive' : 'default'}
                      onClick={() => {
                        updateStatusMutation.mutate({
                          id: statusChangeDialog.assignment.id,
                          status: statusChangeDialog.newStatus,
                          effectiveDate: statusEffectiveDate,
                          reason: statusChangeReason.trim(),
                        });
                      }}
                      disabled={!statusEffectiveDate || !statusChangeReason.trim() || updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isLeft ? 'Confirm — Mark as Left' : `Confirm ${rule.label}`}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Billing Plan Detail Dialog (Read-Only) */}
        <Dialog open={!!billingDetailAssignmentId} onOpenChange={(open) => { if (!open) setBillingDetailAssignmentId(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Linked Billing Plan</DialogTitle>
              <DialogDescription>This billing plan is managed from the Finance module.</DialogDescription>
            </DialogHeader>
            {billingDetailAssignmentId && plansByAssignment[billingDetailAssignmentId] && (() => {
              const plan = plansByAssignment[billingDetailAssignmentId];
              return (
                <div className="space-y-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-medium">{plan.fee_packages?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Fee</span>
                    <span className="font-mono font-semibold">{plan.currency} {Number(plan.net_recurring_fee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>{plan.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">To modify this plan, go to Finance → Billing Plans.</p>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <AssignmentDetailDialog assignmentId={detailAssignmentId} onClose={() => setDetailAssignmentId(null)} />

        <AssignmentHistoryDrawer
          assignmentId={historyAssignmentId}
          open={!!historyAssignmentId}
          onOpenChange={(o) => { if (!o) setHistoryAssignmentId(null); }}
        />
      </div>
    </DashboardLayout>
  );
}
