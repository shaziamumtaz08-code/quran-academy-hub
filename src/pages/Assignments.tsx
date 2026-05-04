import React, { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, GraduationCap, Trash2, Loader2, UserPlus, BookOpen, Pencil, Upload, ArrowRightLeft, Banknote, Eye, Download, Plus, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
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
import { handleSupabaseError } from '@/lib/handleSupabaseError';
import { useDivision } from '@/contexts/DivisionContext';
import { BulkAssignmentImportDialog } from '@/components/assignments/BulkAssignmentImportDialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDisplayDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  paused: { label: 'Paused', color: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', color: 'bg-slate-400', badgeClass: 'bg-slate-400/10 text-slate-600 border-slate-400/20' },
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

type AssignmentStatus = 'active' | 'paused' | 'completed' | 'left';

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
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'newest'>('az');
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Per-column sort + filters
  type SortKey = 'teacher_name' | 'student_name' | 'subject_name' | 'payout_amount' | 'status' | 'created_at';
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [payoutTypeFilter, setPayoutTypeFilter] = useState<string>('all');
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
  // Payout fields
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState('monthly');
  const [effectiveFromDate, setEffectiveFromDate] = useState('');
  const [effectiveToDate, setEffectiveToDate] = useState('');
  // Billing plan detail dialog
  const [billingDetailAssignmentId, setBillingDetailAssignmentId] = useState<string | null>(null);

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
          payout_amount, payout_type, effective_from_date, effective_to_date,
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
        payout_amount: row.payout_amount || 0,
        payout_type: row.payout_type || 'monthly',
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
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .upsert(records, { onConflict: 'teacher_id,student_id', ignoreDuplicates: false })
        .select();
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

  // Update assignment mutation (academic + payout only)
  const updateMutation = useMutation({
    mutationFn: async ({ id, teacherId, subjectId, status }: { id: string; teacherId: string; subjectId?: string; status?: AssignmentStatus }) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({
          teacher_id: teacherId,
          subject_id: subjectId || null,
          payout_amount: parseFloat(payoutAmount) || 0,
          payout_type: payoutType,
          effective_from_date: effectiveFromDate || null,
          ...(status && { status }),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Updated', description: 'Assignment updated successfully' });
      handleCancelEdit();
    },
    onError: (error: any) => {
      handleSupabaseError(error, 'save changes');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, effectiveDate }: { id: string; status: AssignmentStatus; effectiveDate?: string }) => {
      const updatePayload: any = { status };
      if (effectiveDate) {
        updatePayload.status_effective_date = effectiveDate;
        // For left/completed, also set effective_to_date for salary calculation
        if (status === 'left' || status === 'completed') {
          updatePayload.effective_to_date = effectiveDate;
        }
        // For reactivation (active), reset billing start date to reactivation date
        if (status === 'active') {
          updatePayload.effective_from_date = effectiveDate;
        }
      }
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw error;

      // If marking as 'left', also clear schedules and close assignment history
      if (status === 'left') {
        await supabase.from('schedules').delete().eq('assignment_id', id);
        await supabase
          .from('assignment_history')
          .update({ ended_at: effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString() })
          .eq('assignment_id', id)
          .is('ended_at', null);
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Updated', description: status === 'left' ? 'Assignment marked as Left. Schedules cleared.' : 'Assignment status updated' });
      setStatusChangeDialog(null);
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

      if (transferType === 'permanent') {
        // Close current history
        await sb.from('assignment_history')
          .update({ ended_at: new Date(effDate).toISOString(), reason: reason || 'Permanent transfer' })
          .eq('assignment_id', id)
          .is('ended_at', null);

        // Update assignment in place: new teacher + optional payout details
        const updatePayload: any = { teacher_id: newTeacherId, transfer_type: 'permanent' };
        if (pa !== undefined && pa > 0) updatePayload.payout_amount = pa;
        if (pt) updatePayload.payout_type = pt;
        updatePayload.effective_from_date = effDate;

        const { error } = await sb.from('student_teacher_assignments').update(updatePayload).eq('id', id);
        if (error) throw error;

        await sb.from('assignment_history').insert({
          assignment_id: id,
          teacher_id: newTeacherId,
          student_id: assignment.student_id,
          subject_id: assignment.subject_id,
          started_at: new Date(effDate).toISOString(),
          reason: reason || 'Permanent transfer',
        });
      } else {
        // SUBSTITUTE: pause original, create child substitute assignment
        if (!substituteEndDate) throw new Error('Substitute end date is required');

        await sb.from('student_teacher_assignments')
          .update({ status: 'paused', status_effective_date: effDate })
          .eq('id', id);

        // Get full original assignment for cloning fields
        const { data: oldAssign } = await sb
          .from('student_teacher_assignments')
          .select('subject_id, branch_id, division_id, duration_minutes, fee_package_id, requires_schedule, requires_planning, requires_attendance')
          .eq('id', id)
          .single();

        const { data: subAssign } = await sb
          .from('student_teacher_assignments')
          .insert({
            student_id: assignment.student_id,
            teacher_id: newTeacherId,
            subject_id: oldAssign?.subject_id ?? assignment.subject_id,
            branch_id: oldAssign?.branch_id ?? activeDivision?.branch_id ?? null,
            division_id: oldAssign?.division_id ?? activeDivision?.id ?? null,
            duration_minutes: oldAssign?.duration_minutes ?? null,
            payout_amount: pa && pa > 0 ? pa : assignment.payout_amount,
            payout_type: pt || assignment.payout_type,
            fee_package_id: oldAssign?.fee_package_id ?? null,
            status: 'active',
            effective_from_date: effDate,
            effective_to_date: substituteEndDate,
            transfer_type: 'substitute',
            parent_assignment_id: id,
            substitute_end_date: substituteEndDate,
            requires_schedule: oldAssign?.requires_schedule ?? true,
            requires_planning: oldAssign?.requires_planning ?? true,
            requires_attendance: oldAssign?.requires_attendance ?? true,
          })
          .select('id')
          .single();

        if (subAssign) {
          await sb.from('assignment_history').insert({
            assignment_id: subAssign.id,
            student_id: assignment.student_id,
            teacher_id: newTeacherId,
            subject_id: oldAssign?.subject_id ?? assignment.subject_id,
            started_at: new Date(effDate).toISOString(),
            reason: reason || `Temporary substitute until ${substituteEndDate}`,
          });
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({
        title: vars.transferType === 'permanent' ? 'Permanently Reassigned' : 'Substitute Assigned',
        description: vars.transferType === 'permanent'
          ? 'Teacher reassigned. History recorded.'
          : 'Original teacher paused. Will auto-resume after substitute period.',
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
    setEditingAssignment(null);
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setSelectedTeacher('');
    setSelectedStudents([]);
    setSelectedSubject('');
    setPayoutAmount('');
    setPayoutType('monthly');
    setEffectiveFromDate('');
    setIsFormOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedTeacher(assignment.teacher_id);
    setSelectedSubject(assignment.subject_id || '');
    setSelectedStudents([assignment.student_id]);
    setPayoutAmount(assignment.payout_amount?.toString() || '');
    setPayoutType(assignment.payout_type || 'monthly');
    setEffectiveFromDate(assignment.effective_from_date || '');
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

  const handleSubmit = () => {
    if (!selectedTeacher || selectedStudents.length === 0) {
      toast({ title: 'Error', description: 'Select a teacher and at least one student', variant: 'destructive' });
      return;
    }
    if (editingAssignment) {
      updateMutation.mutate({
        id: editingAssignment.id,
        teacherId: selectedTeacher,
        subjectId: selectedSubject || undefined,
      });
    } else {
      createMutation.mutate({
        teacherId: selectedTeacher,
        studentIds: selectedStudents,
        subjectId: selectedSubject || undefined,
      });
    }
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
    paused: assignments.filter(a => a.status === 'paused').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    left: assignments.filter(a => a.status === 'left').length,
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
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
        {(statusCounts.paused > 0 || statusCounts.completed > 0) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {statusCounts.paused > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {statusCounts.paused} paused
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
                  ? 'Update the teacher, subject, or payout details for this assignment.'
                  : 'Assign a teacher to one or more students with payout configuration.'}
              </DialogDescription>
            </DialogHeader>
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
                <Label>Select Students * {editingAssignment && <span className="text-xs text-muted-foreground">(Cannot change student when editing)</span>}</Label>
                <div className={`border border-border rounded-lg max-h-48 overflow-y-auto ${editingAssignment ? 'opacity-60 pointer-events-none' : ''}`}>
                  {students.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">No students found</p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {students.map((student) => (
                        <label key={student.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer">
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => !editingAssignment && handleStudentToggle(student.id)}
                            disabled={!!editingAssignment}
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
                <div className="space-y-1">
                  <Label className="text-xs">Effective From</Label>
                  <Input type="date" value={effectiveFromDate} onChange={(e) => setEffectiveFromDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!selectedTeacher || selectedStudents.length === 0 || isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAssignment ? 'Update Assignment' : 'Save Assignment'}
              </Button>
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
                  <SelectItem value="paused">Paused ({statusCounts.paused})</SelectItem>
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
                              if (value !== 'active' && value !== assignment.status) {
                                setStatusChangeDialog({ assignment, newStatus: value });
                                setStatusEffectiveDate(new Date().toISOString().split('T')[0]);
                              } else if (value === 'active') {
                                updateStatusMutation.mutate({ id: assignment.id, status: value });
                              }
                            }}
                            disabled={updateStatusMutation.isPending}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
                                </span>
                              </SelectItem>
                              <SelectItem value="paused">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Paused
                                </span>
                              </SelectItem>
                              <SelectItem value="completed">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-slate-400" /> Completed
                                </span>
                              </SelectItem>
                              <SelectItem value="left">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-rose-600" /> Left
                                </span>
                              </SelectItem>
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
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditAssignment(assignment); }}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(assignment.id); }} disabled={deleteMutation.isPending}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">Original paused. Auto-reverts after end date.</p>
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
        <Dialog open={!!statusChangeDialog} onOpenChange={(open) => { if (!open) setStatusChangeDialog(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Status Change</DialogTitle>
              <DialogDescription>
                Change <strong>{statusChangeDialog?.assignment.student_name}</strong>'s assignment status to <strong className="capitalize">{statusChangeDialog?.newStatus}</strong>.
                {statusChangeDialog?.newStatus === 'left' && ' This will also clear all schedules.'}
                {statusChangeDialog?.newStatus === 'active' && ' The effective date will be used as the new billing start date (fees prorated from this date).'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Effective Date *</Label>
                <Input
                  type="date"
                  value={statusEffectiveDate}
                  onChange={(e) => setStatusEffectiveDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">This date will be used for salary calculations.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusChangeDialog(null)}>Cancel</Button>
              <Button
                variant={statusChangeDialog?.newStatus === 'left' ? 'destructive' : 'default'}
                onClick={() => {
                  if (statusChangeDialog) {
                    updateStatusMutation.mutate({
                      id: statusChangeDialog.assignment.id,
                      status: statusChangeDialog.newStatus,
                      effectiveDate: statusEffectiveDate,
                    });
                  }
                }}
                disabled={!statusEffectiveDate || updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
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
      </div>
    </DashboardLayout>
  );
}
