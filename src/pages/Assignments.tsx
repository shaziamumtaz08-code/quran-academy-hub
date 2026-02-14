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
import { Users, GraduationCap, Trash2, Loader2, UserPlus, BookOpen, Pencil, Upload, Filter, ArrowRightLeft, Wallet } from 'lucide-react';
import { BillingCalculator } from '@/components/finance/BillingCalculator';
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

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  paused: { label: 'Paused', color: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', color: 'bg-slate-400', badgeClass: 'bg-slate-400/10 text-slate-600 border-slate-400/20' },
} as const;

interface Profile {
  id: string;
  full_name: string;
}

interface Subject {
  id: string;
  name: string;
}

type AssignmentStatus = 'active' | 'paused' | 'completed';

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
  // Billing state
  const [selectedFeePackageId, setSelectedFeePackageId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('30');
  const [selectedDiscountId, setSelectedDiscountId] = useState('');
  const [billingStartDate, setBillingStartDate] = useState('');
  const [overriddenProrated, setOverriddenProrated] = useState<number | null>(null);

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

  // Fetch fee packages
  const { data: feePackages = [] } = useQuery({
    queryKey: ['fee-packages-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_packages')
        .select('id, name, amount, currency, days_per_week')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch discount rules
  const { data: discountRules = [] } = useQuery({
    queryKey: ['discount-rules-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_rules')
        .select('id, name, type, value')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
  // Fetch existing assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['student-teacher-assignments', activeDivision?.id],
    queryFn: async () => {
      let query = supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          subject_id,
          status,
          created_at,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name),
          subject:subjects(name)
        `)
        .order('created_at', { ascending: false });

      if (activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }

      const { data, error } = await query;
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
      })) as Assignment[];
    },
  });

  // Derived billing objects
  const selectedFeePackage = feePackages.find(p => p.id === selectedFeePackageId) || null;
  const selectedDiscount = discountRules.find(d => d.id === selectedDiscountId) || null;

  // Calculate fees for saving
  const computedFees = useMemo(() => {
    if (!selectedFeePackage) return { monthly: 0, prorated: 0 };
    const durationMultiplier = parseInt(selectedDuration) / 30;
    let monthly = selectedFeePackage.amount * durationMultiplier;
    if (selectedDiscount) {
      const disc = selectedDiscount.type === 'percentage'
        ? monthly * (selectedDiscount.value / 100)
        : selectedDiscount.value;
      monthly = Math.max(0, monthly - disc);
    }
    let prorated = monthly;
    if (billingStartDate) {
      const start = new Date(billingStartDate);
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const remaining = daysInMonth - start.getDate() + 1;
      prorated = (monthly / daysInMonth) * remaining;
    }
    return { monthly: Math.round(monthly * 100) / 100, prorated: Math.round(prorated * 100) / 100 };
  }, [selectedFeePackage, selectedDuration, selectedDiscount, billingStartDate]);

  // Create assignments mutation
  const createMutation = useMutation({
    mutationFn: async ({ 
      teacherId, 
      studentIds, 
      subjectId
    }: { 
      teacherId: string; 
      studentIds: string[]; 
      subjectId?: string;
    }) => {
      const records = studentIds.map(studentId => ({
        teacher_id: teacherId,
        student_id: studentId,
        subject_id: subjectId || null,
        fee_package_id: selectedFeePackageId || null,
        duration_minutes: parseInt(selectedDuration) || 30,
        discount_id: selectedDiscountId || null,
        start_date: billingStartDate || null,
        calculated_monthly_fee: computedFees.monthly,
        first_month_prorated_fee: overriddenProrated ?? computedFees.prorated,
        is_custom_override: overriddenProrated !== null,
      }));

      const { error } = await supabase
        .from('student_teacher_assignments')
        .upsert(records, { onConflict: 'teacher_id,student_id', ignoreDuplicates: false });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-students'] });
      toast({ title: 'Success', description: 'Assignments created successfully' });
      setSelectedTeacher('');
      setSelectedStudents([]);
      setSelectedSubject('');
      setSelectedFeePackageId('');
      setSelectedDuration('30');
      setSelectedDiscountId('');
      setBillingStartDate('');
      setOverriddenProrated(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-students'] });
      toast({ title: 'Deleted', description: 'Assignment removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update assignment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, teacherId, subjectId, status }: { id: string; teacherId: string; subjectId?: string; status?: AssignmentStatus }) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({
          teacher_id: teacherId,
          subject_id: subjectId || null,
          ...(status && { status }),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-students'] });
      toast({ title: 'Updated', description: 'Assignment updated successfully' });
      handleCancelEdit();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update status mutation (quick status change)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssignmentStatus }) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      toast({ title: 'Updated', description: 'Assignment status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Reassign teacher mutation - preserves student, subject, schedules
  const reassignMutation = useMutation({
    mutationFn: async ({ id, newTeacherId }: { id: string; newTeacherId: string }) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({ teacher_id: newTeacherId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      toast({ title: 'Reassigned', description: 'Teacher has been reassigned. Student details, subject, and schedules are preserved.' });
      setReassignDialog(null);
      setReassignTeacherId('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedTeacher(assignment.teacher_id);
    setSelectedSubject(assignment.subject_id || '');
    setSelectedStudents([assignment.student_id]);
  };

  const handleCancelEdit = () => {
    setEditingAssignment(null);
    setSelectedTeacher('');
    setSelectedSubject('');
    setSelectedStudents([]);
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

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    let result = assignments.filter(a => 
      statusFilter === 'all' ? true : a.status === statusFilter
    );
    
    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.teacher_name.toLowerCase().includes(term) ||
        a.student_name.toLowerCase().includes(term) ||
        (a.subject_name?.toLowerCase().includes(term) ?? false)
      );
    }

    // Apply sort
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

  // Count by status for filter badges
  const statusCounts = {
    active: assignments.filter(a => a.status === 'active').length,
    paused: assignments.filter(a => a.status === 'paused').length,
    completed: assignments.filter(a => a.status === 'completed').length,
  };

  const resetToolbar = () => {
    setSearchTerm('');
    setSortMode('az');
    setStatusFilter('active');
  };
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Student–Teacher Assignment</h1>
            <p className="text-muted-foreground mt-1">Assign students to teachers with subject</p>
          </div>
          <Button onClick={() => setIsBulkImportOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
        </div>

        <BulkAssignmentImportDialog 
          open={isBulkImportOpen} 
          onOpenChange={setIsBulkImportOpen} 
        />

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
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Selection */}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Selection - disabled when editing */}
              <div className="space-y-2">
                <Label>Select Students * {editingAssignment && <span className="text-xs text-muted-foreground">(Cannot change student when editing)</span>}</Label>
                <div className={`border border-border rounded-lg max-h-48 overflow-y-auto ${editingAssignment ? 'opacity-60 pointer-events-none' : ''}`}>
                  {students.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">No students found</p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                        >
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

              {/* Finance & Billing Section */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="h-4 w-4" />
                  Finance & Billing
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Fee Package</Label>
                    <Select value={selectedFeePackageId} onValueChange={setSelectedFeePackageId}>
                      <SelectTrigger><SelectValue placeholder="Select package..." /></SelectTrigger>
                      <SelectContent>
                        {feePackages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.name} ({pkg.currency} {pkg.amount})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Session Duration</Label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Minutes</SelectItem>
                        <SelectItem value="45">45 Minutes</SelectItem>
                        <SelectItem value="60">60 Minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Apply Discount</Label>
                    <Select value={selectedDiscountId} onValueChange={(v) => setSelectedDiscountId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="No discount" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        {discountRules.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.type === 'percentage' ? `${d.value}%` : d.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={billingStartDate}
                      onChange={(e) => setBillingStartDate(e.target.value)}
                    />
                  </div>
                </div>
                {selectedFeePackage && (
                  <BillingCalculator
                    feePackage={selectedFeePackage}
                    durationMinutes={parseInt(selectedDuration)}
                    discount={selectedDiscount}
                    startDate={billingStartDate}
                    overriddenProrated={overriddenProrated}
                    onOverrideChange={setOverriddenProrated}
                  />
                )}
              </div>

              <div className="flex gap-2">
                {editingAssignment && (
                  <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedTeacher || selectedStudents.length === 0 || isPending}
                  className="flex-1"
                >
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

        {/* Status Summary Info */}
        {(statusCounts.paused > 0 || statusCounts.completed > 0) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {statusCounts.paused > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {statusCounts.paused} paused (planning/scheduling disabled)
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
                <p className="text-sm">
                  {statusFilter !== 'all' ? `Try viewing "All" assignments or create a new one` : 'Create an assignment above to get started'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Teacher</TableHead>
                     <TableHead>Student</TableHead>
                     <TableHead>Subject</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-center">Reassign</TableHead>
                     <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => (
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
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            </SelectItem>
                            <SelectItem value="paused">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                Paused
                              </span>
                            </SelectItem>
                            <SelectItem value="completed">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />
                                Completed
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReassignDialog(assignment);
                            setReassignTeacherId('');
                          }}
                          title="Reassign teacher"
                        >
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditAssignment(assignment);
                            }}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(assignment.id);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Teacher Reassignment Dialog */}
        <Dialog open={!!reassignDialog} onOpenChange={(open) => { if (!open) { setReassignDialog(null); setReassignTeacherId(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Teacher</DialogTitle>
              <DialogDescription>
                Change the teacher for <strong>{reassignDialog?.student_name}</strong>'s assignment.
                Student details, subject ({reassignDialog?.subject_name || 'N/A'}), and existing schedules will be preserved.
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select new teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers
                      .filter(t => t.id !== reassignDialog?.teacher_id)
                      .map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReassignDialog(null); setReassignTeacherId(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (reassignDialog && reassignTeacherId) {
                    reassignMutation.mutate({ id: reassignDialog.id, newTeacherId: reassignTeacherId });
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
      </div>
    </DashboardLayout>
  );
}
