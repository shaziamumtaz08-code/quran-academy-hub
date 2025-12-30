import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Plus, CheckCircle, Clock, Target, User, Loader2, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type PrimaryMarker = 'rukus' | 'pages' | 'lines';
type PlanStatus = 'pending' | 'approved';

interface MonthlyPlan {
  id: string;
  student_id: string;
  teacher_id: string;
  month: string;
  year: string;
  primary_marker: PrimaryMarker;
  monthly_target: number;
  daily_target: number;
  status: PlanStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  subject_id: string | null;
  resource_name: string | null;
  goals: string | null;
  topics_to_cover: string | null;
  page_from: number | null;
  page_to: number | null;
  surah_name: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  student?: { full_name: string };
  teacher?: { full_name: string };
  subject?: { name: string };
}

interface Subject {
  id: string;
  name: string;
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const MARKERS: { value: PrimaryMarker; label: string; unit: string }[] = [
  { value: 'rukus', label: 'Rukus', unit: 'Ruku' },
  { value: 'pages', label: 'Pages', unit: 'Page' },
  { value: 'lines', label: 'Lines', unit: 'Line' },
];

const currentYear = new Date().getFullYear();
const YEARS = [
  currentYear.toString(),
  (currentYear + 1).toString(),
];

// Helper to check if subject is Quran-related
const isQuranSubject = (subjectName: string | null | undefined): boolean => {
  if (!subjectName) return false;
  const name = subjectName.toLowerCase();
  return name.includes('hifz') || name.includes('nazra') || name.includes('nazrah') || name.includes('quran') || name.includes('tajweed');
};

export default function MonthlyPlanning() {
  const { profile, user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'MM'));
  const [yearFilter, setYearFilter] = useState(currentYear.toString());

  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [primaryMarker, setPrimaryMarker] = useState<PrimaryMarker>('lines');
  const [monthlyTarget, setMonthlyTarget] = useState('30');
  const [dailyTarget, setDailyTarget] = useState('1');
  const [notes, setNotes] = useState('');
  
  // Quran-specific fields
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  
  // Non-Quran specific fields
  const [resourceName, setResourceName] = useState('');
  const [goals, setGoals] = useState('');
  const [topicsToCover, setTopicsToCover] = useState('');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');

  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || 
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher';

  // Fetch all subjects
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Subject[];
    },
  });

  // Fetch assigned students for teacher
  const { data: assignedStudents } = useQuery({
    queryKey: ['assigned-students-with-subjects', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeacher) return [];
      
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          student_id, 
          subject_id,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
          subject:subjects(id, name)
        `)
        .eq('teacher_id', user.id);

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.student?.id || d.student_id,
        full_name: d.student?.full_name || 'Unknown',
        subject_id: d.subject_id,
        subject_name: d.subject?.name || null,
      }));
    },
    enabled: !!user?.id && isTeacher,
  });

  // Fetch all students for admin
  const { data: allStudentsData } = useQuery({
    queryKey: ['all-students-with-assignments'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;
      
      const studentIds = (roleData || []).map(r => r.user_id);
      if (studentIds.length === 0) return [];
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);

      if (profileError) throw profileError;
      
      // Get assignments for subjects
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, subject_id, subject:subjects(id, name)')
        .in('student_id', studentIds);
      
      // Create a map of student to subjects
      const studentSubjects = new Map<string, { subject_id: string; subject_name: string }[]>();
      (assignments || []).forEach((a: any) => {
        const existing = studentSubjects.get(a.student_id) || [];
        if (a.subject_id && a.subject?.name) {
          existing.push({ subject_id: a.subject_id, subject_name: a.subject.name });
        }
        studentSubjects.set(a.student_id, existing);
      });
      
      return (profileData || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        subjects: studentSubjects.get(p.id) || [],
      }));
    },
    enabled: isAdmin,
  });

  // Get available subjects for selected student (normalized to { id, name })
  const availableSubjects = useMemo((): { id: string; name: string }[] => {
    if (!selectedStudent) return [];
    
    if (isTeacher && assignedStudents) {
      // For teachers, only show subjects they're assigned to teach this student
      const studentAssignments = assignedStudents.filter(s => s.id === selectedStudent);
      return studentAssignments
        .filter(s => s.subject_id && s.subject_name)
        .map(s => ({ id: s.subject_id!, name: s.subject_name! }));
    }
    
    if (isAdmin && allStudentsData) {
      // For admins, show all subjects assigned to this student
      const student = allStudentsData.find(s => s.id === selectedStudent);
      // Normalize the structure
      return (student?.subjects || []).map(s => ({ 
        id: s.subject_id, 
        name: s.subject_name 
      }));
    }
    
    return [];
  }, [selectedStudent, isTeacher, isAdmin, assignedStudents, allStudentsData]);

  // Get the selected subject details
  const selectedSubjectDetails = useMemo(() => {
    if (!selectedSubject) return null;
    // Check in available subjects first
    const found = availableSubjects.find(s => s.id === selectedSubject);
    if (found) return found;
    // Fallback to all subjects
    return allSubjects.find(s => s.id === selectedSubject) || null;
  }, [selectedSubject, availableSubjects, allSubjects]);

  const isQuran = isQuranSubject(selectedSubjectDetails?.name);

  const students = isAdmin 
    ? (allStudentsData || []).map(s => ({ id: s.id, full_name: s.full_name }))
    : [...new Map((assignedStudents || []).map(s => [s.id, { id: s.id, full_name: s.full_name }])).values()];

  // Reset subject when student changes
  useEffect(() => {
    setSelectedSubject('');
  }, [selectedStudent]);

  // Fetch monthly plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ['monthly-plans', monthFilter, yearFilter, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('student_monthly_plans')
        .select(`
          *,
          student:profiles!student_monthly_plans_student_id_fkey(full_name),
          teacher:profiles!student_monthly_plans_teacher_id_fkey(full_name),
          subject:subjects(name)
        `)
        .eq('month', monthFilter)
        .eq('year', yearFilter)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MonthlyPlan[];
    },
    enabled: !!user?.id,
  });

  // Create/Update plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!selectedStudent) throw new Error('Please select a student');
      if (!selectedSubject) throw new Error('Please select a subject');

      const planData: any = {
        student_id: selectedStudent,
        teacher_id: user.id,
        month: selectedMonth,
        year: selectedYear,
        primary_marker: primaryMarker,
        monthly_target: parseFloat(monthlyTarget),
        daily_target: parseFloat(dailyTarget),
        notes: notes || null,
        status: 'pending' as PlanStatus,
        subject_id: selectedSubject,
      };

      // Add subject-specific fields
      if (isQuran) {
        planData.surah_name = surahName || null;
        planData.ayah_from = ayahFrom ? parseInt(ayahFrom) : null;
        planData.ayah_to = ayahTo ? parseInt(ayahTo) : null;
        // Clear non-Quran fields
        planData.resource_name = null;
        planData.goals = null;
        planData.topics_to_cover = null;
        planData.page_from = null;
        planData.page_to = null;
      } else {
        planData.resource_name = resourceName || null;
        planData.goals = goals || null;
        planData.topics_to_cover = topicsToCover || null;
        planData.page_from = pageFrom ? parseInt(pageFrom) : null;
        planData.page_to = pageTo ? parseInt(pageTo) : null;
        // Clear Quran fields
        planData.surah_name = null;
        planData.ayah_from = null;
        planData.ayah_to = null;
      }

      if (editingPlan) {
        const { error } = await supabase
          .from('student_monthly_plans')
          .update(planData)
          .eq('id', editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('student_monthly_plans')
          .insert(planData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: editingPlan ? 'Plan updated successfully' : 'Plan created successfully' });
      queryClient.invalidateQueries({ queryKey: ['monthly-plans'] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast({ title: 'Error', description: 'A plan already exists for this student and month', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message || 'Failed to save plan', variant: 'destructive' });
      }
    },
  });

  // Approve plan mutation (admin only)
  const approvePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('student_monthly_plans')
        .update({
          status: 'approved' as PlanStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Approved', description: 'Plan has been approved' });
      queryClient.invalidateQueries({ queryKey: ['monthly-plans'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message || 'Failed to approve plan', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSelectedStudent('');
    setSelectedSubject('');
    setSelectedMonth(format(new Date(), 'MM'));
    setSelectedYear(currentYear.toString());
    setPrimaryMarker('lines');
    setMonthlyTarget('30');
    setDailyTarget('1');
    setNotes('');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setResourceName('');
    setGoals('');
    setTopicsToCover('');
    setPageFrom('');
    setPageTo('');
    setEditingPlan(null);
  };

  const openEditDialog = (plan: MonthlyPlan) => {
    setEditingPlan(plan);
    setSelectedStudent(plan.student_id);
    setSelectedSubject(plan.subject_id || '');
    setSelectedMonth(plan.month);
    setSelectedYear(plan.year);
    setPrimaryMarker(plan.primary_marker);
    setMonthlyTarget(plan.monthly_target.toString());
    setDailyTarget(plan.daily_target.toString());
    setNotes(plan.notes || '');
    setSurahName(plan.surah_name || '');
    setAyahFrom(plan.ayah_from?.toString() || '');
    setAyahTo(plan.ayah_to?.toString() || '');
    setResourceName(plan.resource_name || '');
    setGoals(plan.goals || '');
    setTopicsToCover(plan.topics_to_cover || '');
    setPageFrom(plan.page_from?.toString() || '');
    setPageTo(plan.page_to?.toString() || '');
    setDialogOpen(true);
  };

  const getMarkerLabel = (marker: PrimaryMarker) => {
    return MARKERS.find(m => m.value === marker)?.label || marker;
  };

  const formatPeriod = (month: string, year: string) => {
    const monthLabel = MONTHS.find(m => m.value === month)?.label || month;
    return `${monthLabel} ${year}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Monthly Planning</h1>
            <p className="text-muted-foreground mt-1">Set monthly learning goals for students</p>
          </div>
          {(isTeacher || isAdmin) && (
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 inline mr-1" />
            {plans?.length || 0} plans
          </div>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Student Plans - {formatPeriod(monthFilter, yearFilter)}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !plans || plans.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No plans for this period</p>
                <p className="text-sm">Create a monthly plan to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Primary Marker</TableHead>
                    <TableHead className="text-center">Monthly Target</TableHead>
                    <TableHead className="text-center">Daily Target</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{plan.student?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{plan.subject?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getMarkerLabel(plan.primary_marker)}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {plan.monthly_target} {getMarkerLabel(plan.primary_marker)}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {plan.daily_target} / day
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate" title={plan.notes || ''}>
                        {plan.notes || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.status === 'approved' ? (
                          <Badge className="bg-emerald-light/10 text-emerald-light border-emerald-light/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(plan)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          {isAdmin && plan.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => approvePlanMutation.mutate(plan.id)}
                              disabled={approvePlanMutation.isPending}
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Monthly Plan' : 'Create Monthly Plan'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Student Selection */}
            <div className="space-y-2">
              <Label>Step 1: Select Student <span className="text-destructive">*</span></Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(students || []).map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Subject Selection (only shows subjects assigned to selected student) */}
            {selectedStudent && (
              <div className="space-y-2">
                <Label>Step 2: Select Subject <span className="text-destructive">*</span></Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.length === 0 ? (
                      <SelectItem value="" disabled>No subjects assigned</SelectItem>
                    ) : (
                      availableSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {availableSubjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">This student has no subjects assigned. Please assign a subject first.</p>
                )}
              </div>
            )}

            {/* Step 3: Dynamic Form based on Subject */}
            {selectedStudent && selectedSubject && (
              <>
                {/* Month/Year */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional Fields based on Subject Type */}
                {isQuran ? (
                  // Quran-specific fields (Hifz, Nazrah)
                  <div className="space-y-4 p-4 bg-sky/10 dark:bg-sky/20 rounded-lg border border-sky/30">
                    <p className="text-sm font-medium text-sky-dark dark:text-sky-light">Quran Learning Fields</p>
                    
                    <div className="space-y-2">
                      <Label>Primary Marker <span className="text-destructive">*</span></Label>
                      <Select value={primaryMarker} onValueChange={(v) => setPrimaryMarker(v as PrimaryMarker)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKERS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Monthly Target</Label>
                        <Input
                          type="number"
                          min="1"
                          value={monthlyTarget}
                          onChange={(e) => setMonthlyTarget(e.target.value)}
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Daily Target</Label>
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={dailyTarget}
                          onChange={(e) => setDailyTarget(e.target.value)}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Surah Name</Label>
                      <Input
                        value={surahName}
                        onChange={(e) => setSurahName(e.target.value)}
                        placeholder="e.g., Al-Baqarah"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ayah From</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ayahFrom}
                          onChange={(e) => setAyahFrom(e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ayah To</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ayahTo}
                          onChange={(e) => setAyahTo(e.target.value)}
                          placeholder="50"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Non-Quran subject fields (English, Math, etc.)
                  <div className="space-y-4 p-4 bg-accent/50 rounded-lg border border-border">
                    <p className="text-sm font-medium">Academic Subject Fields</p>
                    
                    <div className="space-y-2">
                      <Label>Resource Name</Label>
                      <Input
                        value={resourceName}
                        onChange={(e) => setResourceName(e.target.value)}
                        placeholder="e.g., English Grammar Workbook"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Goals</Label>
                      <Textarea
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                        placeholder="e.g., Improve vocabulary and reading comprehension"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Topics to Cover</Label>
                      <Input
                        value={topicsToCover}
                        onChange={(e) => setTopicsToCover(e.target.value)}
                        placeholder="e.g., Past tense verbs, Prepositions"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>From Page</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pageFrom}
                          onChange={(e) => setPageFrom(e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>To Page</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pageTo}
                          onChange={(e) => setPageTo(e.target.value)}
                          placeholder="30"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => savePlanMutation.mutate()}
              disabled={!selectedStudent || !selectedSubject || savePlanMutation.isPending}
            >
              {savePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}