import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle, XCircle, AlertCircle, User, Plus, Clock, CalendarClock, UserX, Palmtree, Pencil, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { SurahSearchSelect } from '@/components/attendance/SurahSearchSelect';
import { trackActivity } from '@/lib/activityLogger';
import { UnitInputSelector } from '@/components/attendance/UnitInputSelector';
import { QaidaProgressInput } from '@/components/attendance/QaidaProgressInput';
import { HifzAttendanceFields } from '@/components/attendance/HifzAttendanceFields';
import { NazraAttendanceFields } from '@/components/attendance/NazraAttendanceFields';
import { AcademicAttendanceFields, type LessonStatus, type FollowupSuggestion } from '@/components/attendance/AcademicAttendanceFields';
import { type LearningUnit, type MushafType, convertToLines, LEARNING_UNITS } from '@/lib/quranData';
import { getSubjectType, type SubjectType } from '@/lib/subjectUtils';
import { isRepeatLesson as checkRepeatLesson, type LessonPosition } from '@/lib/quranValidation';
import { type MarkerType } from '@/components/attendance/SabaqSection';

type AttendanceStatus = 'present' | 'student_absent' | 'teacher_absent' | 'teacher_leave' | 'rescheduled' | 'student_rescheduled' | 'holiday';
type ReasonCategory = 'sick' | 'personal' | 'emergency' | 'internet_issue' | 'other';
type VarianceReason = 'slow_pace' | 'lack_of_revision' | 'technical_issues' | 'student_late' | 'short_verses';

const VARIANCE_REASONS: { value: VarianceReason; label: string }[] = [
  { value: 'slow_pace', label: 'Slow Pace' },
  { value: 'lack_of_revision', label: 'Lack of Revision' },
  { value: 'technical_issues', label: 'Technical Issues' },
  { value: 'student_late', label: 'Student Late' },
  { value: 'short_verses', label: 'Short Verses' },
];

interface AttendanceRecord {
  id: string;
  class_date: string;
  class_time: string;
  duration_minutes: number;
  status: AttendanceStatus;
  reason: string | null;
  lesson_covered: string | null;
  homework: string | null;
  student_id: string;
  teacher_id: string;
  absence_type: string | null;
  reason_category: ReasonCategory | null;
  reason_text: string | null;
  reschedule_date: string | null;
  reschedule_time: string | null;
  lines_completed: number | null;
  surah_name: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  variance_reason: string | null;
  // Sabaq fields
  sabaq_surah_from: string | null;
  sabaq_surah_to: string | null;
  sabaq_ayah_from: number | null;
  sabaq_ayah_to: number | null;
  sabqi_done: boolean | null;
  manzil_done: boolean | null;
  input_unit: string | null;
  raw_input_amount: number | null;
  lesson_number: number | null;
  page_number: number | null;
  created_at: string;
  student?: { full_name: string };
  teacher?: { full_name: string };
}

interface Profile {
  id: string;
  full_name: string;
  mushaf_type: string;
  daily_target_lines: number;
  preferred_unit?: string;
  daily_target_amount?: number;
  subject_name?: string | null;
  subject_id?: string | null;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'student_absent', label: 'Absent' },
  { value: 'teacher_leave', label: 'Leave' },
  { value: 'teacher_absent', label: 'Teacher Absent' },
  { value: 'rescheduled', label: 'Rescheduled by the Teacher' },
  { value: 'student_rescheduled', label: 'Rescheduled by the Student' },
  { value: 'holiday', label: 'Holiday' },
];

const REASON_CATEGORIES: { value: ReasonCategory; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'internet_issue', label: 'Internet Issue' },
  { value: 'other', label: 'Other' },
];

export default function Attendance() {
  const { profile, user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  
  // Form state for marking attendance
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState('09:00');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState('30');
  const [reason, setReason] = useState('');
  const [lessonCovered, setLessonCovered] = useState('');
  const [homework, setHomework] = useState('');
  
  // New form state for enhanced attendance
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  // Quran tracking fields
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  const [linesCompleted, setLinesCompleted] = useState('');
  const [varianceReason, setVarianceReason] = useState<VarianceReason | ''>('');
  
  // Multi-unit input fields
  const [inputUnit, setInputUnit] = useState<LearningUnit>('lines');
  const [rawInputAmount, setRawInputAmount] = useState('');
  
  // Subject-specific fields
  const [lessonNumber, setLessonNumber] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  
  // Hifz/Nazra-specific fields - New Sabaq Section
  const [markerType, setMarkerType] = useState<MarkerType>('ayah');
  
  // Ruku mode
  const [rukuFromJuz, setRukuFromJuz] = useState('');
  const [rukuFromNumber, setRukuFromNumber] = useState('');
  const [rukuToJuz, setRukuToJuz] = useState('');
  const [rukuToNumber, setRukuToNumber] = useState('');
  
  // Ayah mode
  const [ayahFromSurah, setAyahFromSurah] = useState('');
  const [ayahFromNumber, setAyahFromNumber] = useState('');
  const [ayahToSurah, setAyahToSurah] = useState('');
  const [ayahToNumber, setAyahToNumber] = useState('');
  
  // Quarter mode
  const [quarterFromJuz, setQuarterFromJuz] = useState('');
  const [quarterFromNumber, setQuarterFromNumber] = useState('');
  const [quarterToJuz, setQuarterToJuz] = useState('');
  const [quarterToNumber, setQuarterToNumber] = useState('');
  
  // Legacy fields kept for compatibility
  const [sabaqSurahFrom, setSabaqSurahFrom] = useState('');
  const [sabaqAyahFrom, setSabaqAyahFrom] = useState('');
  const [sabaqSurahTo, setSabaqSurahTo] = useState('');
  const [sabaqAyahTo, setSabaqAyahTo] = useState('');
  const [sabqiDone, setSabqiDone] = useState(false);
  const [manzilDone, setManzilDone] = useState(false);
  
  // Academic-specific fields
  const [academicLessonTopic, setAcademicLessonTopic] = useState('');
  const [academicLessonStatus, setAcademicLessonStatus] = useState<LessonStatus | ''>('');
  const [academicFollowups, setAcademicFollowups] = useState<FollowupSuggestion[]>([]);

  // Role checks based on activeRole
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || 
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher' || activeRole === 'examiner';
  const isStudent = activeRole === 'student';

  // Statuses that require reason
  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'teacher_absent', 'teacher_leave'].includes(status);
  
  // Status requires reschedule info
  const requiresReschedule = (status: AttendanceStatus) => status === 'rescheduled';

  // Fetch assigned students (for teacher) with daily_target_lines, preferred_unit, and subject info
  const { data: assignedStudents } = useQuery({
    queryKey: ['assigned-students', user?.id, isTeacher],
    queryFn: async () => {
      if (!user?.id) return [];
      
      if (isTeacher) {
        // Teacher sees their assigned students with subject info
        const { data, error } = await supabase
          .from('student_teacher_assignments')
          .select('student_id, subject_id, subject:subjects(id, name), student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, mushaf_type, daily_target_lines, preferred_unit, daily_target_amount)')
          .eq('teacher_id', user.id)
          .eq('status', 'active');

        if (error) throw error;
        return (data || []).map(d => ({
          ...d.student,
          subject_name: d.subject?.name || null,
          subject_id: d.subject?.id || null
        })).filter(Boolean) as Profile[];
      } else if (isAdmin) {
        // Admin can see all students with their assignments
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, mushaf_type, daily_target_lines, preferred_unit, daily_target_amount')
          .order('full_name');
        
        if (error) throw error;
        
        // Get role info to filter only students
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', 'student');
        
        const studentIds = new Set((rolesData || []).map(r => r.user_id));
        return (data || []).filter(p => studentIds.has(p.id)) as Profile[];
      }
      
      return [];
    },
    enabled: !!user?.id && (isTeacher || isAdmin),
  });

  // Get selected student's profile and settings
  const selectedStudentProfile = useMemo(() => {
    if (!selectedStudent || !assignedStudents) return null;
    return assignedStudents.find(s => s.id === selectedStudent) || null;
  }, [selectedStudent, assignedStudents]);

  // Set input unit to student's preferred unit when student changes
  useEffect(() => {
    if (selectedStudentProfile?.preferred_unit) {
      setInputUnit(selectedStudentProfile.preferred_unit as LearningUnit);
    }
  }, [selectedStudentProfile]);

  // Determine subject type for the selected student
  const currentSubjectType: SubjectType = useMemo(() => {
    return getSubjectType(selectedStudentProfile?.subject_name);
  }, [selectedStudentProfile]);

  const mushafType = (selectedStudentProfile?.mushaf_type || '15-line') as MushafType;
  const dailyTarget = selectedStudentProfile?.daily_target_lines || 10;
  
  // Fetch last attendance record for this student (for repeat lesson detection)
  const { data: lastAttendance } = useQuery({
    queryKey: ['last-attendance', selectedStudent, user?.id],
    queryFn: async () => {
      if (!selectedStudent || !user?.id) return null;
      
      const { data, error } = await supabase
        .from('attendance')
        .select('sabaq_surah_from, sabaq_ayah_from, sabaq_surah_to, sabaq_ayah_to, surah_name, ayah_from, ayah_to, lesson_number, page_number, class_date')
        .eq('student_id', selectedStudent)
        .eq('status', 'present')
        .order('class_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') return null; // PGRST116 = no rows returned
      return data;
    },
    enabled: !!selectedStudent && !!user?.id,
  });

  // Check if current lesson is a repeat of last lesson
  const isRepeatLessonDetected = useMemo(() => {
    if (!lastAttendance || !sabaqSurahFrom) return false;
    
    const todayPosition: LessonPosition = {
      surahFrom: sabaqSurahFrom,
      ayahFrom: sabaqAyahFrom,
      surahTo: sabaqSurahTo,
      ayahTo: sabaqAyahTo,
    };
    
    const yesterdayPosition: LessonPosition = {
      surahFrom: lastAttendance.sabaq_surah_from || lastAttendance.surah_name || '',
      ayahFrom: lastAttendance.sabaq_ayah_from || lastAttendance.ayah_from || 0,
      surahTo: lastAttendance.sabaq_surah_to || '',
      ayahTo: lastAttendance.sabaq_ayah_to || lastAttendance.ayah_to || 0,
    };
    
    return checkRepeatLesson(todayPosition, yesterdayPosition);
  }, [lastAttendance, sabaqSurahFrom, sabaqAyahFrom, sabaqSurahTo, sabaqAyahTo]);
  
  // Calculate line equivalent from the raw input
  const rawInputNum = parseFloat(rawInputAmount) || 0;
  const lineEquivalent = useMemo(() => {
    return convertToLines(rawInputNum, inputUnit, mushafType);
  }, [rawInputNum, inputUnit, mushafType]);
  
  const needsVarianceReason = lineEquivalent > 0 && lineEquivalent < dailyTarget;

  // Validation
  const isFormValid = useMemo(() => {
    // For teacher leave/absent statuses, don't require student selection
    const isTeacherStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
    
    if (!isTeacherStatus && !selectedStudent) return false;
    if (!classTime) return false;
    
    if (requiresReason(selectedStatus)) {
      if (!reasonCategory) return false;
      if (reasonCategory === 'other' && !reasonText.trim()) return false;
    }
    
    if (requiresReschedule(selectedStatus)) {
      if (!rescheduleDate || !rescheduleTime) return false;
    }
    
    // Variance reason required when lines below target
    if (needsVarianceReason && !varianceReason) return false;
    
    // Surah name must be selected from the list for data integrity
    if (selectedStatus === 'present' && surahName && !surahName.trim()) return false;
    
    return true;
  }, [selectedStudent, selectedStatus, classTime, reasonCategory, reasonText, rescheduleDate, rescheduleTime, needsVarianceReason, varianceReason, surahName]);

  // Fetch parent's children IDs (for parent role)
  const { data: childrenIds } = useQuery({
    queryKey: ['parent-children-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user.id);
      if (error) throw error;
      return (data || []).map(d => d.student_id);
    },
    enabled: !!user?.id && activeRole === 'parent',
  });

  // Fetch attendance records with explicit role-based filters
  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['attendance', user?.id, monthFilter, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = startOfMonth(parseISO(`${monthFilter}-01`));
      const endDate = endOfMonth(startDate);

      let query = supabase
        .from('attendance')
        .select(`
          id,
          class_date,
          class_time,
          duration_minutes,
          status,
          reason,
          lesson_covered,
          homework,
          student_id,
          teacher_id,
          absence_type,
          reason_category,
          reason_text,
          reschedule_date,
          reschedule_time,
          lines_completed,
          surah_name,
          ayah_from,
          ayah_to,
          variance_reason,
          sabaq_surah_from,
          sabaq_surah_to,
          sabaq_ayah_from,
          sabaq_ayah_to,
          sabqi_done,
          manzil_done,
          input_unit,
          raw_input_amount,
          lesson_number,
          page_number,
          created_at,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name)
        `)
        .gte('class_date', format(startDate, 'yyyy-MM-dd'))
        .lte('class_date', format(endDate, 'yyyy-MM-dd'))
        .order('class_date', { ascending: false });

      // Apply explicit role-based filters (not relying on RLS for multi-role users)
      if (isTeacher) {
        query = query.eq('teacher_id', user.id);
      } else if (isStudent) {
        query = query.eq('student_id', user.id);
      } else if (activeRole === 'parent' && childrenIds && childrenIds.length > 0) {
        query = query.in('student_id', childrenIds);
      }
      // Admins see all - no additional filter

      const { data, error } = await query;
      if (error) throw error;
      // Filter out ghost data (records where student profile no longer exists)
      return ((data || []) as AttendanceRecord[]).filter(record => record.student?.full_name);
    },
    enabled: !!user?.id && (activeRole !== 'parent' || (childrenIds !== undefined)),
  });

  // Mark attendance mutation
  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user');
      
      const isTeacherStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
      
      // For teacher statuses, we still need a student_id - use first assigned student or throw error
      let studentId = selectedStudent;
      if (isTeacherStatus && !studentId && assignedStudents && assignedStudents.length > 0) {
        studentId = assignedStudents[0].id;
      }
      
      if (!studentId && !isTeacherStatus) {
        throw new Error('Please select a student');
      }

      // Build the auto-generated note for rescheduled
      let finalReason = reason;
      if (selectedStatus === 'rescheduled' && rescheduleDate && rescheduleTime) {
        finalReason = `Class rescheduled from ${classDate} ${classTime} to ${rescheduleDate} ${rescheduleTime}`;
      }

      // Build lesson_covered based on subject type
      let lessonCoveredText = '';
      if (currentSubjectType === 'qaida') {
        lessonCoveredText = lessonNumber ? `Lesson ${lessonNumber}${pageNumber ? `, Page ${pageNumber}` : ''}` : '';
      } else if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') {
        if (sabaqSurahFrom && sabaqAyahFrom) {
          lessonCoveredText = `${sabaqSurahFrom} ${sabaqAyahFrom}`;
          if (sabaqSurahTo && sabaqAyahTo) {
            lessonCoveredText += ` - ${sabaqSurahTo} ${sabaqAyahTo}`;
          }
        }
      } else {
        // Academic subjects - use lessonTopic and status
        if (academicLessonTopic) {
          lessonCoveredText = academicLessonTopic;
          if (academicLessonStatus) {
            const statusLabel = academicLessonStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            lessonCoveredText += ` (${statusLabel})`;
          }
          if (academicFollowups.length > 0) {
            lessonCoveredText += ` | Follow-up: ${academicFollowups.map(f => f.replace('_', ' ')).join(', ')}`;
          }
        }
      }

      // Calculate final lines completed from the unit input
      const finalLinesCompleted = lineEquivalent > 0 ? Math.round(lineEquivalent) : null;

      const { error } = await supabase.from('attendance').insert({
        student_id: studentId || user.id,
        teacher_id: user.id,
        class_date: classDate,
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: selectedStatus,
        reason: finalReason || null,
        lesson_covered: lessonCoveredText || null,
        homework: homework || null,
        reason_category: reasonCategory || null,
        reason_text: reasonCategory === 'other' ? reasonText : null,
        reschedule_date: rescheduleDate || null,
        reschedule_time: rescheduleTime || null,
        surah_name: currentSubjectType === 'qaida' ? null : (sabaqSurahFrom || surahName || null),
        ayah_from: currentSubjectType === 'qaida' ? null : (sabaqAyahFrom ? parseInt(sabaqAyahFrom) : (ayahFrom ? parseInt(ayahFrom) : null)),
        ayah_to: currentSubjectType === 'qaida' ? null : (sabaqAyahTo ? parseInt(sabaqAyahTo) : (ayahTo ? parseInt(ayahTo) : null)),
        lines_completed: finalLinesCompleted,
        variance_reason: needsVarianceReason ? varianceReason : null,
        input_unit: inputUnit,
        raw_input_amount: rawInputNum > 0 ? rawInputNum : null,
        // New subject-specific fields
        lesson_number: currentSubjectType === 'qaida' && lessonNumber ? parseInt(lessonNumber) : null,
        page_number: currentSubjectType === 'qaida' && pageNumber ? parseInt(pageNumber) : null,
        sabaq_surah_from: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? sabaqSurahFrom || null : null,
        sabaq_surah_to: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? sabaqSurahTo || null : null,
        sabaq_ayah_from: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') && sabaqAyahFrom ? parseInt(sabaqAyahFrom) : null,
        sabaq_ayah_to: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') && sabaqAyahTo ? parseInt(sabaqAyahTo) : null,
        sabqi_done: currentSubjectType === 'hifz' ? sabqiDone : null,
        manzil_done: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? manzilDone : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Attendance Marked', description: 'Attendance has been recorded successfully.' });
      // Invalidate all relevant queries for immediate UI updates
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      resetForm();
      setMarkDialogOpen(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  // Update attendance mutation (admin only)
  const updateAttendance = useMutation({
    mutationFn: async (record: AttendanceRecord) => {
      const { error } = await supabase.from('attendance').update({
        status: record.status,
        class_date: record.class_date,
        class_time: record.class_time,
        duration_minutes: record.duration_minutes,
        lesson_covered: record.lesson_covered,
        homework: record.homework,
        reason_category: record.reason_category,
        reason_text: record.reason_text,
        surah_name: record.surah_name,
        ayah_from: record.ayah_from,
        ayah_to: record.ayah_to,
        lines_completed: record.lines_completed,
        variance_reason: record.variance_reason,
        // Sabaq fields
        sabaq_surah_from: record.sabaq_surah_from,
        sabaq_surah_to: record.sabaq_surah_to,
        sabaq_ayah_from: record.sabaq_ayah_from,
        sabaq_ayah_to: record.sabaq_ayah_to,
        sabqi_done: record.sabqi_done,
        manzil_done: record.manzil_done,
        input_unit: record.input_unit,
        raw_input_amount: record.raw_input_amount,
        lesson_number: record.lesson_number,
        page_number: record.page_number,
      }).eq('id', record.id);
      if (error) throw error;
      
      // Log activity for admin edits
      await trackActivity({
        action: 'attendance_updated',
        entityType: 'attendance',
        entityId: record.id,
        details: {
          student_id: record.student_id,
          student_name: record.student?.full_name,
          class_date: record.class_date,
          status: record.status,
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Attendance record updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setEditDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update', variant: 'destructive' });
    },
  });

  // Delete attendance mutation (admin only)
  const deleteAttendanceMutation = useMutation({
    mutationFn: async (recordIds: string[]) => {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .in('id', recordIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Attendance record(s) deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setSelectedRecordIds(new Set());
    },
    onError: (error) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
    },
  });

  // Toggle selection for bulk delete
  const toggleRecordSelection = (recordId: string) => {
    const newSet = new Set(selectedRecordIds);
    if (newSet.has(recordId)) {
      newSet.delete(recordId);
    } else {
      newSet.add(recordId);
    }
    setSelectedRecordIds(newSet);
  };

  const toggleSelectAllRecords = () => {
    if (selectedRecordIds.size === filteredRecords.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const resetForm = () => {
    setSelectedStudent('');
    setSelectedStatus('present');
    setClassTime('09:00');
    setClassDate(format(new Date(), 'yyyy-MM-dd'));
    setDuration('30');
    setReason('');
    setLessonCovered('');
    setHomework('');
    setReasonCategory('');
    setReasonText('');
    setRescheduleDate('');
    setRescheduleTime('');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setLinesCompleted('');
    setVarianceReason('');
    setInputUnit('lines');
    setRawInputAmount('');
    // Subject-specific resets
    setLessonNumber('');
    setPageNumber('');
    setSabaqSurahFrom('');
    setSabaqAyahFrom('');
    setSabaqSurahTo('');
    setSabaqAyahTo('');
    setSabqiDone(false);
    setManzilDone(false);
    // Academic resets
    setAcademicLessonTopic('');
    setAcademicLessonStatus('');
    setAcademicFollowups([]);
  };

  const filteredRecords = useMemo(() => {
    if (!attendanceRecords) return [];
    if (filter === 'all') return attendanceRecords;
    return attendanceRecords.filter(r => r.status === filter);
  }, [attendanceRecords, filter]);

  const stats = useMemo(() => {
    const records = attendanceRecords || [];
    return {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      studentAbsent: records.filter(r => r.status === 'student_absent').length,
      teacherOff: records.filter(r => ['teacher_absent', 'teacher_leave'].includes(r.status)).length,
      rescheduled: records.filter(r => r.status === 'rescheduled').length,
      holiday: records.filter(r => r.status === 'holiday').length,
    };
  }, [attendanceRecords]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-light" />;
      case 'student_absent':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'teacher_absent':
      case 'teacher_leave':
        return <UserX className="h-4 w-4 text-accent" />;
      case 'rescheduled':
        return <CalendarClock className="h-4 w-4 text-primary" />;
      case 'holiday':
        return <Palmtree className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || status;
  };

  const months = [
    { value: `${new Date().getFullYear()}-01`, label: 'January' },
    { value: `${new Date().getFullYear()}-02`, label: 'February' },
    { value: `${new Date().getFullYear()}-03`, label: 'March' },
    { value: `${new Date().getFullYear()}-04`, label: 'April' },
    { value: `${new Date().getFullYear()}-05`, label: 'May' },
    { value: `${new Date().getFullYear()}-06`, label: 'June' },
    { value: `${new Date().getFullYear()}-07`, label: 'July' },
    { value: `${new Date().getFullYear()}-08`, label: 'August' },
    { value: `${new Date().getFullYear()}-09`, label: 'September' },
    { value: `${new Date().getFullYear()}-10`, label: 'October' },
    { value: `${new Date().getFullYear()}-11`, label: 'November' },
    { value: `${new Date().getFullYear()}-12`, label: 'December' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Attendance Records</h1>
            <p className="text-muted-foreground mt-1">
              {isTeacher ? 'Mark and manage class attendance' : 
               isStudent ? 'View your attendance history' : 
               'View and manage attendance across the academy'}
            </p>
          </div>
          {/* Both Admin and Teacher can mark attendance */}
          {(isAdmin || isTeacher) && (
            <Button 
              onClick={() => setMarkDialogOpen(true)}
              title="Mark attendance"
            >
              <Plus className="h-4 w-4 mr-2" />
              Mark Attendance
            </Button>
          )}
        </div>

        {/* Stats - Enhanced for Admin */}
        <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-4")}>
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Classes</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-light/10 border-emerald-light/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-emerald-light">{stats.present}</p>
              <p className="text-sm text-emerald-light/80">Present</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-destructive">{stats.studentAbsent}</p>
              <p className="text-sm text-destructive/80">Student Absent</p>
            </CardContent>
          </Card>
          {isAdmin && (
            <>
              <Card className="bg-accent/10 border-accent/20 text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-accent">{stats.teacherOff}</p>
                  <p className="text-sm text-accent/80">Teacher Off</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/20 text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-primary">{stats.rescheduled}</p>
                  <p className="text-sm text-primary/80">Rescheduled</p>
                </CardContent>
              </Card>
              <Card className="bg-muted text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.holiday}</p>
                  <p className="text-sm text-muted-foreground">Holidays</p>
                </CardContent>
              </Card>
            </>
          )}
          {!isAdmin && (
            <Card className="bg-accent/10 border-accent/20 text-center">
              <CardContent className="pt-6">
                <p className="text-2xl font-serif font-bold text-accent">{stats.rescheduled}</p>
                <p className="text-sm text-accent/80">Rescheduled</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Admin Bulk Actions */}
        {isAdmin && selectedRecordIds.size > 0 && (
          <div className="flex items-center gap-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <span className="text-sm font-medium">{selectedRecordIds.size} record(s) selected</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Attendance Records</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedRecordIds.size} attendance record(s)? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteAttendanceMutation.mutate(Array.from(selectedRecordIds))}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No attendance records found</p>
                <p className="text-sm mt-1">
                  {isTeacher ? 'Start marking attendance for your students' : 
                   'Attendance records will appear here once marked'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0}
                          onCheckedChange={toggleSelectAllRecords}
                        />
                      </TableHead>
                    )}
                    <TableHead>Date</TableHead>
                    {!isStudent && <TableHead>Student</TableHead>}
                    {isAdmin && <TableHead>Teacher</TableHead>}
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lesson Covered</TableHead>
                    {(isTeacher || isAdmin) && <TableHead>Reason</TableHead>}
                    {isAdmin && <TableHead>Reschedule Info</TableHead>}
                    <TableHead className="text-xs">Created (PKT)</TableHead>
                    {(isAdmin || isTeacher) && <TableHead className="w-24">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow 
                      key={record.id}
                      className={selectedRecordIds.has(record.id) ? "bg-primary/5" : ""}
                    >
                      {isAdmin && (
                        <TableCell>
                          <Checkbox 
                            checked={selectedRecordIds.has(record.id)}
                            onCheckedChange={() => toggleRecordSelection(record.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(record.class_date), 'MMM dd, yyyy')}
                        </span>
                      </TableCell>
                      {!isStudent && (
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.student?.full_name || 'Unknown'}</span>
                          </span>
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell>{record.teacher?.full_name || 'Unknown'}</TableCell>
                      )}
                      <TableCell>{record.class_time?.substring(0, 5) || '-'}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          record.status === 'present' && "bg-emerald-light/10 text-emerald-light",
                          record.status === 'student_absent' && "bg-destructive/10 text-destructive",
                          ['teacher_absent', 'teacher_leave'].includes(record.status) && "bg-accent/10 text-accent",
                          record.status === 'rescheduled' && "bg-primary/10 text-primary",
                          record.status === 'holiday' && "bg-muted text-muted-foreground"
                        )}>
                          {getStatusIcon(record.status)}
                          {getStatusLabel(record.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {record.lesson_covered || '-'}
                      </TableCell>
                      {(isTeacher || isAdmin) && (
                        <TableCell className="text-muted-foreground max-w-[150px]">
                          {record.reason_category ? (
                            <span className="capitalize">
                              {record.reason_category === 'other' 
                                ? record.reason_text 
                                : record.reason_category.replace('_', ' ')}
                            </span>
                          ) : record.reason || '-'}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">
                          {record.reschedule_date ? (
                            <span className="text-xs">
                              {format(parseISO(record.reschedule_date), 'MMM dd')} {record.reschedule_time?.substring(0, 5)}
                            </span>
                          ) : '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {record.created_at ? format(parseISO(record.created_at), 'MMM dd, h:mm a') : '-'}
                      </TableCell>
                      {(isAdmin || isTeacher) && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingRecord(record);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this attendance record for {record.student?.full_name} on {format(parseISO(record.class_date), 'MMM dd, yyyy')}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteAttendanceMutation.mutate([record.id])}
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
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Mark Attendance Dialog */}
        <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Mark Attendance</DialogTitle>
              <DialogDescription>
                Record attendance for a class
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Status Selection */}
              <div className="space-y-2">
                <Label>Status <span className="text-destructive">*</span></Label>
                <Select value={selectedStatus} onValueChange={(v) => {
                  setSelectedStatus(v as AttendanceStatus);
                  // Reset conditional fields when status changes
                  setReasonCategory('');
                  setReasonText('');
                  setRescheduleDate('');
                  setRescheduleTime('');
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Selection - Only show for non-teacher statuses */}
              {!['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus) && (
                <div className="space-y-2">
                  <Label>Student <span className="text-destructive">*</span></Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assignedStudents || []).map((student) => (
                        <SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignedStudents?.length === 0 && (
                    <p className="text-sm text-muted-foreground">No students assigned to you yet.</p>
                  )}
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Class Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={classTime} onChange={(e) => setClassTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>

              {/* Reason Category - Required for absence statuses */}
              {requiresReason(selectedStatus) && (
                <>
                  <div className="space-y-2">
                    <Label>Reason <span className="text-destructive">*</span></Label>
                    <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCategory)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text reason for "Other" */}
                  {reasonCategory === 'other' && (
                    <div className="space-y-2">
                      <Label>Specify Reason <span className="text-destructive">*</span></Label>
                      <Textarea
                        placeholder="Please specify the reason..."
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Reschedule Fields */}
              {requiresReschedule(selectedStatus) && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Reschedule Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Date <span className="text-destructive">*</span></Label>
                      <Input 
                        type="date" 
                        value={rescheduleDate} 
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Time <span className="text-destructive">*</span></Label>
                      <Input 
                        type="time" 
                        value={rescheduleTime} 
                        onChange={(e) => setRescheduleTime(e.target.value)} 
                      />
                    </div>
                  </div>
                  {rescheduleDate && rescheduleTime && (
                    <p className="text-xs text-muted-foreground italic">
                      Auto-note: Class rescheduled from {classDate} {classTime} to {rescheduleDate} {rescheduleTime}
                    </p>
                  )}
                </div>
              )}

              {/* Subject-Specific Progress Section - Only for present/rescheduled */}
              {['present', 'rescheduled'].includes(selectedStatus) && selectedStudent && (
                <>
                  {/* Qaida Progress */}
                  {currentSubjectType === 'qaida' && (
                    <QaidaProgressInput
                      lessonNumber={lessonNumber}
                      onLessonNumberChange={setLessonNumber}
                      pageNumber={pageNumber}
                      onPageNumberChange={setPageNumber}
                    />
                  )}
                  
                  {/* Hifz Progress */}
                  {currentSubjectType === 'hifz' && (
                    <HifzAttendanceFields
                      markerType={markerType}
                      onMarkerTypeChange={setMarkerType}
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
                      sabqiDone={sabqiDone}
                      onSabqiDoneChange={setSabqiDone}
                      manzilDone={manzilDone}
                      onManzilDoneChange={setManzilDone}
                      isRepeatLesson={isRepeatLessonDetected}
                    />
                  )}
                  
                  {/* Nazra Progress */}
                  {currentSubjectType === 'nazra' && (
                    <NazraAttendanceFields
                      markerType={markerType}
                      onMarkerTypeChange={setMarkerType}
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
                      manzilDone={manzilDone}
                      onManzilDoneChange={setManzilDone}
                      isRepeatLesson={isRepeatLessonDetected}
                    />
                  )}
                  
                  {/* Academic/Generic Progress - New Clean Form */}
                  {currentSubjectType === 'academic' && (
                    <AcademicAttendanceFields
                      lessonTopic={academicLessonTopic}
                      onLessonTopicChange={setAcademicLessonTopic}
                      lessonStatus={academicLessonStatus}
                      onLessonStatusChange={setAcademicLessonStatus}
                      homework={homework}
                      onHomeworkChange={setHomework}
                      followupSuggestions={academicFollowups}
                      onFollowupSuggestionsChange={setAcademicFollowups}
                    />
                  )}
                  
                  {/* Homework field only for Quran subjects (Hifz, Nazra, Qaida) */}
                  {currentSubjectType !== 'academic' && (
                    <div className="space-y-2">
                      <Label>Homework</Label>
                      <Textarea
                        placeholder="Enter homework or notes..."
                        value={homework}
                        onChange={(e) => setHomework(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Optional free-text reason for non-required statuses */}
              {!requiresReason(selectedStatus) && !requiresReschedule(selectedStatus) && selectedStatus !== 'present' && (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { resetForm(); setMarkDialogOpen(false); }}>
                Cancel
              </Button>
              <Button 
                onClick={() => markAttendance.mutate()} 
                disabled={!isFormValid || markAttendance.isPending}
              >
                {markAttendance.isPending ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Attendance Dialog - Admin and Teacher */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Edit Attendance</DialogTitle>
              <DialogDescription>
                {editingRecord?.student?.full_name && (
                  <span className="font-medium">Student: {editingRecord.student.full_name}</span>
                )}
                {editingRecord?.created_at && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Created: {format(parseISO(editingRecord.created_at), 'MMM dd, yyyy h:mm a')} PKT
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {editingRecord && (
              <div className="space-y-4 py-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editingRecord.status} 
                    onValueChange={(v) => setEditingRecord({...editingRecord, status: v as AttendanceStatus})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date, Time, Duration - Admin can edit time */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Class Date</Label>
                    <Input 
                      type="date" 
                      value={editingRecord.class_date} 
                      onChange={(e) => setEditingRecord({...editingRecord, class_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Class Time {isAdmin && <span className="text-xs text-muted-foreground">(editable)</span>}</Label>
                    <Input 
                      type="time" 
                      value={editingRecord.class_time?.substring(0, 5) || ''} 
                      onChange={(e) => setEditingRecord({...editingRecord, class_time: e.target.value})}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input 
                      type="number" 
                      value={editingRecord.duration_minutes} 
                      onChange={(e) => setEditingRecord({...editingRecord, duration_minutes: parseInt(e.target.value) || 30})}
                    />
                  </div>
                </div>

                {/* Sabaq Section - Surah/Ayah Range */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <p className="text-sm font-medium">Sabaq (New Lesson)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Surah From</Label>
                      <Input 
                        value={editingRecord.sabaq_surah_from || ''} 
                        onChange={(e) => setEditingRecord({...editingRecord, sabaq_surah_from: e.target.value || null})}
                        placeholder="e.g., Al-Baqarah"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ayah From</Label>
                      <Input 
                        type="number" 
                        value={editingRecord.sabaq_ayah_from || ''} 
                        onChange={(e) => setEditingRecord({...editingRecord, sabaq_ayah_from: parseInt(e.target.value) || null})}
                        placeholder="e.g., 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Surah To</Label>
                      <Input 
                        value={editingRecord.sabaq_surah_to || ''} 
                        onChange={(e) => setEditingRecord({...editingRecord, sabaq_surah_to: e.target.value || null})}
                        placeholder="e.g., Al-Baqarah"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ayah To</Label>
                      <Input 
                        type="number" 
                        value={editingRecord.sabaq_ayah_to || ''} 
                        onChange={(e) => setEditingRecord({...editingRecord, sabaq_ayah_to: parseInt(e.target.value) || null})}
                        placeholder="e.g., 10"
                      />
                    </div>
                  </div>
                  
                  {/* Sabqi and Manzil checkboxes */}
                  <div className="flex items-center gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="edit-sabqi-done"
                        checked={editingRecord.sabqi_done || false}
                        onCheckedChange={(checked) => setEditingRecord({...editingRecord, sabqi_done: checked as boolean})}
                      />
                      <Label htmlFor="edit-sabqi-done" className="text-sm font-normal">Sabqi Done</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="edit-manzil-done"
                        checked={editingRecord.manzil_done || false}
                        onCheckedChange={(checked) => setEditingRecord({...editingRecord, manzil_done: checked as boolean})}
                      />
                      <Label htmlFor="edit-manzil-done" className="text-sm font-normal">Manzil Done</Label>
                    </div>
                  </div>
                </div>

                {/* Lesson Covered & Homework */}
                <div className="space-y-2">
                  <Label>Lesson Covered</Label>
                  <Input 
                    value={editingRecord.lesson_covered || ''} 
                    onChange={(e) => setEditingRecord({...editingRecord, lesson_covered: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Homework</Label>
                  <Textarea 
                    value={editingRecord.homework || ''} 
                    onChange={(e) => setEditingRecord({...editingRecord, homework: e.target.value})}
                    rows={2}
                  />
                </div>

                {/* Lines Completed & Variance */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Lines Completed</Label>
                    <Input 
                      type="number" 
                      value={editingRecord.lines_completed || ''} 
                      onChange={(e) => setEditingRecord({...editingRecord, lines_completed: parseInt(e.target.value) || null})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Variance Reason</Label>
                    <Select 
                      value={editingRecord.variance_reason || 'none'} 
                      onValueChange={(v) => setEditingRecord({...editingRecord, variance_reason: v === 'none' ? null : v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select if needed" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {VARIANCE_REASONS.map((vr) => (
                          <SelectItem key={vr.value} value={vr.value}>{vr.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lesson Number / Page Number for Qaida */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Lesson Number</Label>
                    <Input 
                      type="number" 
                      value={editingRecord.lesson_number || ''} 
                      onChange={(e) => setEditingRecord({...editingRecord, lesson_number: parseInt(e.target.value) || null})}
                      placeholder="For Qaida"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Number</Label>
                    <Input 
                      type="number" 
                      value={editingRecord.page_number || ''} 
                      onChange={(e) => setEditingRecord({...editingRecord, page_number: parseInt(e.target.value) || null})}
                      placeholder="For Qaida"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingRecord(null); }}>Cancel</Button>
              <Button 
                onClick={() => editingRecord && updateAttendance.mutate(editingRecord)} 
                disabled={updateAttendance.isPending}
              >
                {updateAttendance.isPending ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
