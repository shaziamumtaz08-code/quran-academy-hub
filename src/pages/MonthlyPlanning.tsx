import React, { useState, useMemo } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Plus, CheckCircle, Clock, Target, User, Loader2, Edit, AlertTriangle, Trash2, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { calculateWorkingDaysInMonth } from '@/lib/subjectUtils';
import { PlanningMarkerSection, PlanMarkerType } from '@/components/planning/PlanningMarkerSection';
import { JUZ_DATA } from '@/lib/juzData';
import { SURAHS, getSurahByName } from '@/lib/quranData';

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
  surah_from: string | null;
  surah_to: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  teaching_strategy: string | null;
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
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit'); // For admin full-form view
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'MM'));
  const [yearFilter, setYearFilter] = useState(currentYear.toString());
  
  // DEBUG MODE state
  const [debugPayload, setDebugPayload] = useState<object | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [primaryMarker, setPrimaryMarker] = useState<PrimaryMarker>('lines');
  const [notes, setNotes] = useState('');
  
  // Planning marker state (for Quran subjects)
  const [planMarkerType, setPlanMarkerType] = useState<PlanMarkerType>('ruku');
  const [rukuFromJuz, setRukuFromJuz] = useState('');
  const [rukuFromNumber, setRukuFromNumber] = useState('');
  const [rukuToJuz, setRukuToJuz] = useState('');
  const [rukuToNumber, setRukuToNumber] = useState('');
  const [ayahFromSurah, setAyahFromSurah] = useState('');
  const [ayahFromNumber, setAyahFromNumber] = useState('');
  const [ayahToSurah, setAyahToSurah] = useState('');
  const [ayahToNumber, setAyahToNumber] = useState('');
  const [quarterFromJuz, setQuarterFromJuz] = useState('');
  const [quarterFromNumber, setQuarterFromNumber] = useState('');
  const [quarterToJuz, setQuarterToJuz] = useState('');
  const [quarterToNumber, setQuarterToNumber] = useState('');
  
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

  // Fetch assigned students for teacher (with assignment_id for linking)
  const { data: assignedStudents = [], isLoading: assignedStudentsLoading } = useQuery({
    queryKey: ['assigned-students-with-subjects', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeacher) return [];
      
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          student_id, 
          subject_id,
          status,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
          subject:subjects(id, name)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (error) throw error;
      return (data || []).map(d => ({
        assignment_id: d.id,
        id: d.student?.id || d.student_id,
        full_name: d.student?.full_name || 'Unknown',
        subject_id: d.subject_id,
        subject_name: d.subject?.name || null,
      }));
    },
    enabled: !!user?.id && isTeacher,
  });

  // Fetch all students for admin (with assignment info)
  const { data: allStudentsData = [], isLoading: allStudentsLoading } = useQuery({
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
      
      // Get active assignments for subjects with assignment_id
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student_id, teacher_id, subject_id, subject:subjects(id, name)')
        .in('student_id', studentIds)
        .eq('status', 'active');
      
      // Create a map of student to assignments
      const studentAssignments = new Map<string, { assignment_id: string; teacher_id: string; subject_id: string; subject_name: string }[]>();
      (assignments || []).forEach((a: any) => {
        const existing = studentAssignments.get(a.student_id) || [];
        if (a.subject_id && a.subject?.name) {
          existing.push({ 
            assignment_id: a.id,
            teacher_id: a.teacher_id,
            subject_id: a.subject_id, 
            subject_name: a.subject.name 
          });
        }
        studentAssignments.set(a.student_id, existing);
      });
      
      return (profileData || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        assignments: studentAssignments.get(p.id) || [],
      }));
    },
    enabled: isAdmin,
  });

  // Fetch active subject assignments for selected student (admin)
  const { data: adminStudentAssignments = [], isLoading: adminStudentAssignmentsLoading } = useQuery({
    queryKey: ['admin-student-active-assignments', selectedStudent],
    queryFn: async () => {
      if (!selectedStudent) return [];

      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, subject_id, subject:subjects(id, name)')
        .eq('student_id', selectedStudent)
        .eq('status', 'active');

      if (error) throw error;

      return (data || [])
        .filter((a: any) => a.subject_id && a.subject?.name)
        .map((a: any) => ({
          assignment_id: a.id as string,
          teacher_id: a.teacher_id as string,
          subject_id: a.subject_id as string,
          subject_name: a.subject.name as string,
        }));
    },
    enabled: isAdmin && !!selectedStudent,
  });

  // Get available subjects for selected student (normalized to { id, name, assignment_id })
  const availableSubjects = useMemo((): { id: string; name: string; assignment_id?: string }[] => {
    if (!selectedStudent) return [];

    if (isTeacher) {
      // For teachers, only show subjects they're assigned to teach this student
      const studentAssignments = assignedStudents.filter((s: any) => s.id === selectedStudent);
      return studentAssignments
        .filter((s: any) => s.subject_id && s.subject_name)
        .map((s: any) => ({ id: s.subject_id!, name: s.subject_name!, assignment_id: s.assignment_id }));
    }

    if (isAdmin) {
      // For admins, show all active subjects assigned to this student
      return adminStudentAssignments.map((a: any) => ({
        id: a.subject_id,
        name: a.subject_name,
        assignment_id: a.assignment_id,
      }));
    }

    return [];
  }, [selectedStudent, isTeacher, isAdmin, assignedStudents, adminStudentAssignments]);

  // Get the selected subject details (including assignment_id)
  const selectedSubjectDetails = useMemo(() => {
    if (!selectedSubject) return null;
    // Check in available subjects first (has assignment_id)
    const found = availableSubjects.find((s) => s.id === selectedSubject);
    if (found) return found;
    // Fallback to all subjects (no assignment_id)
    const fromAll = allSubjects.find((s) => s.id === selectedSubject);
    return fromAll ? { ...fromAll, assignment_id: undefined } : null;
  }, [selectedSubject, availableSubjects, allSubjects]);

  const isQuran = isQuranSubject(selectedSubjectDetails?.name ?? editingPlan?.subject?.name);

  const studentsLoading = isAdmin ? allStudentsLoading : assignedStudentsLoading;
  const subjectsLoading = isAdmin ? adminStudentAssignmentsLoading : false;

  const students = useMemo(() => {
    const base = isAdmin
      ? (allStudentsData as any[]).map((s: any) => ({ id: s.id, full_name: s.full_name }))
      : [...new Map((assignedStudents as any[]).map((s: any) => [s.id, { id: s.id, full_name: s.full_name }])).values()];

    if (editingPlan && !base.some((s) => s.id === editingPlan.student_id)) {
      return [
        { id: editingPlan.student_id, full_name: editingPlan.student?.full_name || 'Selected student' },
        ...base,
      ];
    }

    return base;
  }, [isAdmin, allStudentsData, assignedStudents, editingPlan]);

  const handleStudentChange = (value: string) => {
    setSelectedStudent(value);
    setSelectedSubject('');
  };

  const subjectOptions = useMemo(() => {
    const base = availableSubjects;
    if (editingPlan?.subject_id && !base.some((s) => s.id === editingPlan.subject_id)) {
      return [
        {
          id: editingPlan.subject_id,
          name: editingPlan.subject?.name || 'Selected subject',
          assignment_id: undefined,
        },
        ...base,
      ];
    }
    return base;
  }, [availableSubjects, editingPlan]);

  // Fetch schedule for selected student + subject (to calculate teaching days)
  const { data: studentSchedule } = useQuery({
    queryKey: ['student-schedule-for-planning', selectedStudent, selectedSubjectDetails?.assignment_id],
    queryFn: async () => {
      const assignmentId = selectedSubjectDetails?.assignment_id;
      if (!assignmentId) return [];
      
      const { data, error } = await supabase
        .from('schedules')
        .select('day_of_week, is_active')
        .eq('assignment_id', assignmentId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStudent && !!selectedSubjectDetails?.assignment_id,
  });

  // Calculate total teaching days based on schedule and selected month/year
  const totalTeachingDays = useMemo(() => {
    if (!studentSchedule || studentSchedule.length === 0) return 0;
    const scheduleDays = studentSchedule.map(s => s.day_of_week);
    return calculateWorkingDaysInMonth(scheduleDays, parseInt(selectedYear), parseInt(selectedMonth));
  }, [studentSchedule, selectedMonth, selectedYear]);

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

  // Calculate monthly target based on marker type (imported from PlanningMarkerSection logic)
  const calculatedMonthlyTarget = useMemo(() => {
    if (isQuran) {
      if (planMarkerType === 'ruku') {
        const fromJuz = parseInt(rukuFromJuz) || 0;
        const fromRuku = parseInt(rukuFromNumber) || 0;
        const toJuz = parseInt(rukuToJuz) || 0;
        const toRuku = parseInt(rukuToNumber) || 0;
        if (!fromJuz || !toJuz || !fromRuku || !toRuku) return 0;
        
        if (fromJuz === toJuz) {
          return Math.max(0, toRuku - fromRuku + 1);
        }
        
        let total = 0;
        // Rukus remaining in fromJuz
        const fromJuzInfo = JUZ_DATA.find(j => j.number === fromJuz);
        if (fromJuzInfo) total += fromJuzInfo.rukuCount - fromRuku + 1;
        // Full Juz in between
        for (let j = fromJuz + 1; j < toJuz; j++) {
          const juzInfo = JUZ_DATA.find(juz => juz.number === j);
          if (juzInfo) total += juzInfo.rukuCount;
        }
        // Rukus in toJuz
        total += toRuku;
        return total;
      }
      
      if (planMarkerType === 'quarter') {
        const fromJuz = parseInt(quarterFromJuz) || 0;
        const fromQ = parseInt(quarterFromNumber) || 0;
        const toJuz = parseInt(quarterToJuz) || 0;
        const toQ = parseInt(quarterToNumber) || 0;
        if (!fromJuz || !toJuz || !fromQ || !toQ) return 0;
        
        if (fromJuz === toJuz) {
          return Math.max(0, toQ - fromQ + 1);
        }
        const quartersPerJuz = 4;
        let total = quartersPerJuz - fromQ + 1;
        total += (toJuz - fromJuz - 1) * quartersPerJuz;
        total += toQ;
        return total;
      }
      
      // Ayah mode - count total ayahs
      if (planMarkerType === 'ayah') {
        const fromSurah = getSurahByName(ayahFromSurah);
        const toSurah = getSurahByName(ayahToSurah);
        const fromAyah = parseInt(ayahFromNumber) || 0;
        const toAyah = parseInt(ayahToNumber) || 0;
        
        if (fromSurah && toSurah && fromAyah && toAyah) {
          if (fromSurah.number === toSurah.number) {
            return Math.max(0, toAyah - fromAyah + 1);
          }
          let total = fromSurah.totalAyahs - fromAyah + 1;
          for (let i = fromSurah.number + 1; i < toSurah.number; i++) {
            const midSurah = SURAHS.find(s => s.number === i);
            if (midSurah) total += midSurah.totalAyahs;
          }
          total += toAyah;
          return total;
        }
        return 0;
      }
    } else {
      // Academic: monthly target = page range
      const from = parseInt(pageFrom) || 0;
      const to = parseInt(pageTo) || 0;
      if (from && to) return Math.max(0, to - from + 1);
    }
    return 0;
  }, [isQuran, planMarkerType, rukuFromJuz, rukuFromNumber, rukuToJuz, rukuToNumber, 
      quarterFromJuz, quarterFromNumber, quarterToJuz, quarterToNumber,
      ayahFromSurah, ayahFromNumber, ayahToSurah, ayahToNumber, pageFrom, pageTo]);

  // Build payload function (extracted for DEBUG MODE)
  const buildPlanPayload = () => {
    const assignmentId = selectedSubjectDetails?.assignment_id;
    
    // Get student and subject names for debugging context
    const studentName = students.find(s => s.id === selectedStudent)?.full_name || 'Unknown';
    const subjectName = selectedSubjectDetails?.name || editingPlan?.subject?.name || 'Unknown';

    // Calculate daily target: monthly / teaching days (minimum 1)
    const dailyTarget = totalTeachingDays > 0 
      ? Math.ceil(calculatedMonthlyTarget / totalTeachingDays) || 1 
      : 1;

    // Build marker data JSON for storage in teaching_strategy field
    const markerData = isQuran ? {
      type: planMarkerType,
      rukuFromJuz: rukuFromJuz || null,
      rukuFromNumber: rukuFromNumber || null,
      rukuToJuz: rukuToJuz || null,
      rukuToNumber: rukuToNumber || null,
      quarterFromJuz: quarterFromJuz || null,
      quarterFromNumber: quarterFromNumber || null,
      quarterToJuz: quarterToJuz || null,
      quarterToNumber: quarterToNumber || null,
    } : null;

    const planData: any = {
      // Debug context (not sent to DB)
      _debug_student_name: studentName,
      _debug_subject_name: subjectName,
      _debug_is_quran: isQuran,
      _debug_editing: !!editingPlan,
      _debug_plan_id: editingPlan?.id || null,
      _debug_calculated_monthly_target: calculatedMonthlyTarget,
      _debug_marker_data: markerData,
      // Actual DB fields
      student_id: selectedStudent,
      teacher_id: user?.id,
      assignment_id: assignmentId || null,
      month: selectedMonth,
      year: selectedYear,
      primary_marker: planMarkerType === 'ruku' ? 'rukus' : planMarkerType === 'ayah' ? 'lines' : 'pages',
      monthly_target: calculatedMonthlyTarget, // FIX: Use calculated value
      daily_target: dailyTarget,
      total_teaching_days: totalTeachingDays || null,
      notes: notes || null,
      status: 'pending' as PlanStatus,
      subject_id: selectedSubject,
      // Store marker selections as JSON in teaching_strategy for Quran subjects
      teaching_strategy: markerData ? JSON.stringify(markerData) : null,
    };

    // Add subject-specific fields
    if (isQuran) {
      if (planMarkerType === 'ayah') {
        planData.surah_from = ayahFromSurah || null;
        planData.surah_to = ayahToSurah || null;
        planData.ayah_from = ayahFromNumber ? parseInt(ayahFromNumber, 10) : null;
        planData.ayah_to = ayahToNumber ? parseInt(ayahToNumber, 10) : null;
      } else {
        planData.surah_from = null;
        planData.surah_to = null;
        planData.ayah_from = null;
        planData.ayah_to = null;
      }
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
      planData.page_from = pageFrom ? parseInt(pageFrom, 10) : null; // FIX: Ensure numeric
      planData.page_to = pageTo ? parseInt(pageTo, 10) : null;
      // Clear Quran fields
      planData.surah_from = null;
      planData.surah_to = null;
      planData.ayah_from = null;
      planData.ayah_to = null;
    }

    return planData;
  };

  // DEBUG MODE: Handle submit with payload preview
  const handleDebugSubmit = () => {
    if (!user?.id) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      return;
    }
    if (!selectedStudent) {
      toast({ title: 'Error', description: 'Please select a student', variant: 'destructive' });
      return;
    }
    if (!selectedSubject) {
      toast({ title: 'Error', description: 'Please select a subject', variant: 'destructive' });
      return;
    }

    const payload = buildPlanPayload();
    
    // Log to console
    console.log("MonthlyPlanningPayload", payload);
    
    // Show debug modal
    setDebugPayload(payload);
    setShowDebugModal(true);
  };

  // Create/Update plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!selectedStudent) throw new Error('Please select a student');
      if (!selectedSubject) throw new Error('Please select a subject');

      const payload = buildPlanPayload();
      
      // Remove debug fields before sending to DB
      const planData = { ...payload };
      delete planData._debug_student_name;
      delete planData._debug_subject_name;
      delete planData._debug_is_quran;
      delete planData._debug_editing;
      delete planData._debug_plan_id;
      delete planData._debug_calculated_monthly_target;
      delete planData._debug_marker_data;

      let savedPlanId: string | null = null;

      if (editingPlan) {
        const { error } = await supabase
          .from('student_monthly_plans')
          .update(planData)
          .eq('id', editingPlan.id);
        if (error) throw error;
        savedPlanId = editingPlan.id;
      } else {
        const { data, error } = await supabase
          .from('student_monthly_plans')
          .insert(planData)
          .select('id')
          .single();
        if (error) throw error;
        savedPlanId = data?.id || null;
      }

      // POST-SAVE VERIFICATION: Fetch saved record and log it
      if (savedPlanId) {
        const { data: savedRecord, error: fetchError } = await supabase
          .from('student_monthly_plans')
          .select('*')
          .eq('id', savedPlanId)
          .single();
        
        if (fetchError) {
          console.warn('MonthlyPlanning: Post-save verification failed', fetchError);
        } else {
          console.log('MonthlyPlanning: POST-SAVE VERIFICATION - Saved record:', savedRecord);
          console.log('MonthlyPlanning: monthly_target saved:', savedRecord?.monthly_target);
          console.log('MonthlyPlanning: page_from saved:', savedRecord?.page_from);
          console.log('MonthlyPlanning: teaching_strategy (marker data):', savedRecord?.teaching_strategy);
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: editingPlan ? 'Plan updated successfully' : 'Plan created successfully' });
      queryClient.invalidateQueries({ queryKey: ['monthly-plans'] });
      resetForm();
      setDialogOpen(false);
      setShowDebugModal(false);
      setDebugPayload(null);
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

  // Delete plan mutation (admin only)
  const deletePlanMutation = useMutation({
    mutationFn: async (planIds: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('student_monthly_plans')
        .delete()
        .in('id', planIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Plan(s) deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['monthly-plans'] });
      setSelectedPlanIds(new Set());
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete plan(s)', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSelectedStudent('');
    setSelectedSubject('');
    setSelectedMonth(format(new Date(), 'MM'));
    setSelectedYear(currentYear.toString());
    setPrimaryMarker('lines');
    setNotes('');
    setPlanMarkerType('ruku');
    setRukuFromJuz('');
    setRukuFromNumber('');
    setRukuToJuz('');
    setRukuToNumber('');
    setAyahFromSurah('');
    setAyahFromNumber('');
    setAyahToSurah('');
    setAyahToNumber('');
    setQuarterFromJuz('');
    setQuarterFromNumber('');
    setQuarterToJuz('');
    setQuarterToNumber('');
    setResourceName('');
    setGoals('');
    setTopicsToCover('');
    setPageFrom('');
    setPageTo('');
    setEditingPlan(null);
  };

  const openEditDialog = (plan: MonthlyPlan, mode: 'edit' | 'view' = 'edit') => {
    setEditingPlan(plan);
    setViewMode(mode);
    setSelectedStudent(plan.student_id);
    setSelectedSubject(plan.subject_id || '');
    setSelectedMonth(plan.month);
    setSelectedYear(plan.year);
    setPrimaryMarker(plan.primary_marker);
    setNotes(plan.notes || '');
    
    // Reset all marker fields first
    setRukuFromJuz('');
    setRukuFromNumber('');
    setRukuToJuz('');
    setRukuToNumber('');
    setQuarterFromJuz('');
    setQuarterFromNumber('');
    setQuarterToJuz('');
    setQuarterToNumber('');
    setAyahFromSurah('');
    setAyahFromNumber('');
    setAyahToSurah('');
    setAyahToNumber('');
    
    // Try to restore marker data from teaching_strategy JSON
    if (plan.teaching_strategy) {
      try {
        const markerData = typeof plan.teaching_strategy === 'string' 
          ? JSON.parse(plan.teaching_strategy) 
          : plan.teaching_strategy;
        
        console.log('MonthlyPlanning: Restoring marker data from teaching_strategy:', markerData);
        
        if (markerData.type) {
          setPlanMarkerType(markerData.type as PlanMarkerType);
        }
        if (markerData.rukuFromJuz) setRukuFromJuz(markerData.rukuFromJuz);
        if (markerData.rukuFromNumber) setRukuFromNumber(markerData.rukuFromNumber);
        if (markerData.rukuToJuz) setRukuToJuz(markerData.rukuToJuz);
        if (markerData.rukuToNumber) setRukuToNumber(markerData.rukuToNumber);
        if (markerData.quarterFromJuz) setQuarterFromJuz(markerData.quarterFromJuz);
        if (markerData.quarterFromNumber) setQuarterFromNumber(markerData.quarterFromNumber);
        if (markerData.quarterToJuz) setQuarterToJuz(markerData.quarterToJuz);
        if (markerData.quarterToNumber) setQuarterToNumber(markerData.quarterToNumber);
      } catch (e) {
        console.warn('MonthlyPlanning: Failed to parse teaching_strategy as JSON:', e);
        // Fallback to primary_marker mapping
        if (plan.primary_marker === 'rukus') {
          setPlanMarkerType('ruku');
        } else if (plan.primary_marker === 'lines') {
          setPlanMarkerType('ayah');
        } else {
          setPlanMarkerType('quarter');
        }
      }
    } else {
      // No teaching_strategy, use primary_marker mapping
      if (plan.primary_marker === 'rukus') {
        setPlanMarkerType('ruku');
      } else if (plan.primary_marker === 'lines') {
        setPlanMarkerType('ayah');
      } else {
        setPlanMarkerType('quarter');
      }
    }
    
    // Restore ayah values if present (for ayah mode)
    if (plan.ayah_from) setAyahFromNumber(plan.ayah_from.toString());
    if (plan.ayah_to) setAyahToNumber(plan.ayah_to.toString());
    if (plan.surah_from) setAyahFromSurah(plan.surah_from);
    if (plan.surah_to) setAyahToSurah(plan.surah_to);
    
    // Restore academic fields
    setResourceName(plan.resource_name || '');
    setGoals(plan.goals || '');
    setTopicsToCover(plan.topics_to_cover || '');
    setPageFrom(plan.page_from?.toString() || '');
    setPageTo(plan.page_to?.toString() || '');
    
    setDialogOpen(true);
  };

  // Toggle selection for bulk delete
  const togglePlanSelection = (planId: string) => {
    const newSet = new Set(selectedPlanIds);
    if (newSet.has(planId)) {
      newSet.delete(planId);
    } else {
      newSet.add(planId);
    }
    setSelectedPlanIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!plans) return;
    if (selectedPlanIds.size === plans.length) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(plans.map(p => p.id)));
    }
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

        {/* Info Alert */}
        <Alert className="bg-muted/50 border-muted-foreground/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Monthly plans can only be created for <strong>active</strong> assignments. 
            Paused or completed assignments are excluded from planning.
          </AlertDescription>
        </Alert>

        {/* Admin Bulk Actions */}
        {isAdmin && selectedPlanIds.size > 0 && (
          <div className="flex items-center gap-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <span className="text-sm font-medium">{selectedPlanIds.size} plan(s) selected</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Plans</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedPlanIds.size} plan(s)? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deletePlanMutation.mutate(Array.from(selectedPlanIds))}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

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
                    {isAdmin && (
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={selectedPlanIds.size === plans.length && plans.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Primary Marker</TableHead>
                    <TableHead className="text-center">Monthly Target</TableHead>
                    <TableHead className="text-center">Daily Target</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead className="text-xs">Created (PKT)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow 
                      key={plan.id} 
                      className={cn(
                        isAdmin && "cursor-pointer hover:bg-muted/50",
                        selectedPlanIds.has(plan.id) && "bg-primary/5"
                      )}
                      onClick={(e) => {
                        // Only open view dialog if clicking on the row (not buttons/checkboxes)
                        if (isAdmin && !(e.target as HTMLElement).closest('button, [role="checkbox"]')) {
                          openEditDialog(plan, 'view');
                        }
                      }}
                    >
                      {isAdmin && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedPlanIds.has(plan.id)}
                            onCheckedChange={() => togglePlanSelection(plan.id)}
                          />
                        </TableCell>
                      )}
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
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {plan.created_at ? format(parseISO(plan.created_at), 'MMM dd, h:mm a') : '-'}
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
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(plan, 'view')}
                              title="View full form"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(plan, 'edit')}
                            title="Edit"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this plan for {plan.student?.full_name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deletePlanMutation.mutate([plan.id])}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      {/* Create/Edit/View Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { resetForm(); setViewMode('edit'); } }}>
        <DialogContent className={cn(
          "sm:max-w-xl max-h-[90vh] overflow-y-auto",
          viewMode === 'view' && isAdmin && "bg-[#1e3a5f] border-[#2d4a6f] text-white"
        )}>
          <DialogHeader>
            <DialogTitle className={viewMode === 'view' && isAdmin ? 'text-white' : ''}>
              {viewMode === 'view' ? 'View Monthly Plan' : editingPlan ? 'Edit Monthly Plan' : 'Create Monthly Plan'}
            </DialogTitle>
            {viewMode === 'view' && editingPlan && (
              <div className="flex items-center gap-2 mt-2">
                <Badge className={editingPlan.status === 'approved' 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }>
                  {editingPlan.status === 'approved' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                  {editingPlan.status === 'approved' ? 'Approved' : 'Pending Approval'}
                </Badge>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* When editing an existing plan, show read-only student/subject info instead of dropdowns */}
            {editingPlan ? (
              <div className="space-y-4">
                {/* Read-only Student & Subject display */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Student</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="font-medium">{editingPlan.student?.full_name || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <Badge variant="outline" className="mt-1">{editingPlan.subject?.name || selectedSubjectDetails?.name || '-'}</Badge>
                  </div>
                </div>
                {/* Period display for existing plan */}
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30 border">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Period</Label>
                    <span className="text-sm font-medium">
                      {MONTHS.find(m => m.value === editingPlan.month)?.label} {editingPlan.year}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <span className="text-xs text-muted-foreground">
                      {editingPlan.created_at ? format(parseISO(editingPlan.created_at), 'MMM dd, yyyy h:mm a') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Student Selection (only for new plans) */}
                <div className="space-y-2">
                  <Label>Step 1: Select Student <span className="text-destructive">*</span></Label>
                  <Select value={selectedStudent} onValueChange={handleStudentChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {studentsLoading ? (
                        <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                      ) : students.length === 0 ? (
                        <SelectItem value="__empty__" disabled>No students found</SelectItem>
                      ) : (
                        students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Subject Selection (only for new plans) */}
                {selectedStudent && (
                  <div className="space-y-2">
                    <Label>Step 2: Select Subject <span className="text-destructive">*</span></Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsLoading ? (
                          <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                        ) : subjectOptions.length === 0 ? (
                          <SelectItem value="__no_subjects__" disabled>No subjects assigned</SelectItem>
                        ) : (
                          subjectOptions.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {subjectOptions.length === 0 && !subjectsLoading && (
                      <p className="text-xs text-muted-foreground">This student has no subjects assigned. Please assign a subject first.</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Step 3: Dynamic Form based on Subject - show when editing OR when student+subject selected */}
            {(editingPlan || (selectedStudent && selectedSubject)) && (
              <>
                {/* Month/Year - only show for NEW plans, editing uses read-only display above */}
                {!editingPlan && (
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
                )}

                {/* Conditional Fields based on Subject Type */}
                {isQuran ? (
                  // Quran-specific fields - use new PlanningMarkerSection
                  <PlanningMarkerSection
                    markerType={planMarkerType}
                    onMarkerTypeChange={setPlanMarkerType}
                    rukuFromJuz={rukuFromJuz}
                    onRukuFromJuzChange={setRukuFromJuz}
                    rukuFromNumber={rukuFromNumber}
                    onRukuFromNumberChange={setRukuFromNumber}
                    rukuToJuz={rukuToJuz}
                    onRukuToJuzChange={setRukuToJuz}
                    rukuToNumber={rukuToNumber}
                    onRukuToNumberChange={setRukuToNumber}
                    ayahFromSurah={ayahFromSurah}
                    onAyahFromSurahChange={setAyahFromSurah}
                    ayahFromNumber={ayahFromNumber}
                    onAyahFromNumberChange={setAyahFromNumber}
                    ayahToSurah={ayahToSurah}
                    onAyahToSurahChange={setAyahToSurah}
                    ayahToNumber={ayahToNumber}
                    onAyahToNumberChange={setAyahToNumber}
                    quarterFromJuz={quarterFromJuz}
                    onQuarterFromJuzChange={setQuarterFromJuz}
                    quarterFromNumber={quarterFromNumber}
                    onQuarterFromNumberChange={setQuarterFromNumber}
                    quarterToJuz={quarterToJuz}
                    onQuarterToJuzChange={setQuarterToJuz}
                    quarterToNumber={quarterToNumber}
                    onQuarterToNumberChange={setQuarterToNumber}
                    totalTeachingDays={totalTeachingDays}
                    monthLabel={MONTHS.find(m => m.value === selectedMonth)?.label || ''}
                    year={selectedYear}
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                ) : (
                  // Non-Quran subject fields (English, Math, etc.) - Dark Navy Theme
                  <div className="bg-[#1e3a5f] rounded-xl p-5 border border-[#2d4a6f] shadow-lg space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-cyan-400" />
                      <h3 className="font-semibold text-base text-cyan-300">Academic Subject Fields</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Resource Name</Label>
                      <Input
                        value={resourceName}
                        onChange={(e) => setResourceName(e.target.value)}
                        placeholder="e.g., English Grammar Workbook"
                        className="bg-white text-navy-900 border-0 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Goals</Label>
                      <Textarea
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                        placeholder="e.g., Improve vocabulary and reading comprehension"
                        rows={2}
                        className="bg-white text-navy-900 border-0 placeholder:text-slate-400 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Topics to Cover</Label>
                      <Input
                        value={topicsToCover}
                        onChange={(e) => setTopicsToCover(e.target.value)}
                        placeholder="e.g., Past tense verbs, Prepositions"
                        className="bg-white text-navy-900 border-0 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-200">From Page</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pageFrom}
                          onChange={(e) => setPageFrom(e.target.value)}
                          placeholder="1"
                          className="bg-white text-navy-900 border-0 placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-200">To Page</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pageTo}
                          onChange={(e) => setPageTo(e.target.value)}
                          placeholder="30"
                          className="bg-white text-navy-900 border-0 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Notes inside Academic section */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Notes (Optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional notes..."
                        rows={2}
                        className="bg-white text-navy-900 border-0 placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>
                )}

              </>
            )}
          </div>

          <DialogFooter className={cn("gap-2", viewMode === 'view' && isAdmin && "border-t border-[#2d4a6f] pt-4")}>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className={viewMode === 'view' && isAdmin ? 'border-sky-400/30 text-sky-200 hover:bg-sky-900/50' : ''}
            >
              Cancel
            </Button>
            {viewMode === 'view' && isAdmin && editingPlan && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setViewMode('edit')}
                  className="border-sky-400/30 text-sky-200 hover:bg-sky-900/50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {editingPlan.status === 'pending' && (
                  <Button
                    onClick={() => {
                      approvePlanMutation.mutate(editingPlan.id);
                      setDialogOpen(false);
                    }}
                    disabled={approvePlanMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {approvePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                )}
              </>
            )}
            {viewMode === 'edit' && (
              <Button
                onClick={handleDebugSubmit}
                disabled={!selectedStudent || !selectedSubject || savePlanMutation.isPending}
              >
                {savePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DEBUG MODE Modal */}
      <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              DEBUG MODE - Payload Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/50 p-4 rounded-lg border">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {debugPayload ? JSON.stringify(debugPayload, null, 2) : 'No payload'}
            </pre>
          </div>
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              This is the exact payload that will be sent to the database. Check the console for the same output.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDebugModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => savePlanMutation.mutate()}
              disabled={savePlanMutation.isPending}
            >
              {savePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Save to Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}