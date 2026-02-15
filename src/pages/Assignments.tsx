import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, GraduationCap, Trash2, Loader2, UserPlus, BookOpen, Pencil, Upload, ArrowRightLeft, Banknote, Eye, Download } from 'lucide-react';
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
import { useDivision } from '@/contexts/DivisionContext';
import { BulkAssignmentImportDialog } from '@/components/assignments/BulkAssignmentImportDialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDisplayDate } from '@/lib/dateFormat';

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
  const [reassignDialog, setReassignDialog] = useState<Assignment | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  // Payout fields
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState('monthly');
  const [effectiveFromDate, setEffectiveFromDate] = useState('');
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
        .select('id, full_name')
        .in('id', studentIds)
        .order('full_name', { ascending: true });
      if (profileError) throw profileError;
      return (profiles ?? []) as Profile[];
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
          payout_amount, payout_type, effective_from_date,
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssignmentStatus }) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;

      // If marking as 'left', also clear schedules and close assignment history
      if (status === 'left') {
        await supabase.from('schedules').delete().eq('assignment_id', id);
        await supabase
          .from('assignment_history')
          .update({ ended_at: new Date().toISOString() })
          .eq('assignment_id', id)
          .is('ended_at', null);
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Updated', description: status === 'left' ? 'Assignment marked as Left. Schedules cleared.' : 'Assignment status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Reassign teacher mutation - NOW logs history instead of overwriting
  const reassignMutation = useMutation({
    mutationFn: async ({ id, newTeacherId, reason }: { id: string; newTeacherId: string; reason?: string }) => {
      // Find the current assignment to log history
      const assignment = assignments.find(a => a.id === id);
      if (!assignment) throw new Error('Assignment not found');

      // Close current history record
      await supabase
        .from('assignment_history')
        .update({ ended_at: new Date().toISOString() })
        .eq('assignment_id', id)
        .is('ended_at', null);

      // Update the assignment teacher
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({ teacher_id: newTeacherId })
        .eq('id', id);
      if (error) throw error;

      // Create new history record
      await supabase.from('assignment_history').insert({
        assignment_id: id,
        teacher_id: newTeacherId,
        student_id: assignment.student_id,
        subject_id: assignment.subject_id,
        reason: reason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Reassigned', description: 'Teacher reassigned. History recorded.' });
      setReassignDialog(null);
      setReassignTeacherId('');
      setReassignReason('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedTeacher(assignment.teacher_id);
    setSelectedSubject(assignment.subject_id || '');
    setSelectedStudents([assignment.student_id]);
    setPayoutAmount(assignment.payout_amount?.toString() || '');
    setPayoutType(assignment.payout_type || 'monthly');
    setEffectiveFromDate(assignment.effective_from_date || '');
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
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.teacher_name.toLowerCase().includes(term) ||
        a.student_name.toLowerCase().includes(term) ||
        (a.subject_name?.toLowerCase().includes(term) ?? false)
      );
    }
    result.sort((a, b) => {
      switch (sortMode) {
        case 'az': return a.student_name.localeCompare(b.student_name);
        case 'za': return b.student_name.localeCompare(a.student_name);
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });
    return result;
  }, [assignments, statusFilter, searchTerm, sortMode]);

  const statusCounts = {
    active: assignments.filter(a => a.status === 'active').length,
    paused: assignments.filter(a => a.status === 'paused').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    left: assignments.filter(a => a.status === 'left').length,
  };

  const resetToolbar = () => {
    setSearchTerm('');
    setSortMode('az');
    setStatusFilter('active');
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
          </div>
        </div>

        <BulkAssignmentImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assignment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Teacher Selection */}
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

              {/* Subject Selection */}
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

              {/* Student Selection */}
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
                          <span className="text-sm">{student.full_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStudents.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedStudents.length} student(s) selected</p>
                )}
              </div>

              {/* Teacher Payout Section */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Banknote className="h-4 w-4" />
                  Teacher Payout
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Payout Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                    />
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
                  <Input
                    type="date"
                    value={effectiveFromDate}
                    onChange={(e) => setEffectiveFromDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {editingAssignment && (
                  <Button variant="outline" onClick={handleCancelEdit} className="flex-1">Cancel</Button>
                )}
                <Button onClick={handleSubmit} disabled={!selectedTeacher || selectedStudents.length === 0 || isPending} className="flex-1">
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAssignment ? 'Update Assignment' : 'Save Assignment'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="space-y-4">
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

        {/* Assignments Table */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Assignments</CardTitle>
            <TableToolbar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search by name or subject..."
              sortValue={sortMode}
              onSortChange={(v) => setSortMode(v as 'az' | 'za' | 'newest')}
              sortOptions={[
                { value: 'az', label: 'A → Z (Student)' },
                { value: 'za', label: 'Z → A (Student)' },
                { value: 'newest', label: 'Newest First' },
              ]}
              filterValue={statusFilter}
              onFilterChange={(v) => setStatusFilter(v as AssignmentStatus | 'all')}
              filterOptions={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: `Active (${statusCounts.active})` },
                { value: 'paused', label: `Paused (${statusCounts.paused})` },
                { value: 'completed', label: `Completed (${statusCounts.completed})` },
                { value: 'left', label: `Left (${statusCounts.left})` },
              ]}
              filterLabel="Status"
              onReset={resetToolbar}
            />
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
                    <TableHead>Teacher</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Billing Plan</TableHead>
                    <TableHead>Status</TableHead>
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
                          <Select
                            value={assignment.status}
                            onValueChange={(value: AssignmentStatus) =>
                              updateStatusMutation.mutate({ id: assignment.id, status: value })
                            }
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
                            onClick={(e) => { e.stopPropagation(); setReassignDialog(assignment); setReassignTeacherId(''); setReassignReason(''); }}
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
        <Dialog open={!!reassignDialog} onOpenChange={(open) => { if (!open) { setReassignDialog(null); setReassignTeacherId(''); setReassignReason(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Teacher</DialogTitle>
              <DialogDescription>
                Change the teacher for <strong>{reassignDialog?.student_name}</strong>'s assignment.
                A history record will be created for audit purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
              <Button variant="outline" onClick={() => { setReassignDialog(null); setReassignTeacherId(''); setReassignReason(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (reassignDialog && reassignTeacherId) {
                    reassignMutation.mutate({ id: reassignDialog.id, newTeacherId: reassignTeacherId, reason: reassignReason });
                  }
                }}
                disabled={!reassignTeacherId || reassignMutation.isPending}
              >
                {reassignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reassign
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
