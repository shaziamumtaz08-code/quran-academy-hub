import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CheckCircle, XCircle, AlertCircle, User, Plus, Clock, CalendarClock, UserX, Palmtree, Pencil, Trash2, ArrowUpDown, CalendarRange, Search, Ban, AlertTriangle, Users } from 'lucide-react';
import { GroupAttendanceTab } from '@/components/attendance/GroupAttendanceTab';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError } from '@/lib/handleSupabaseError';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO, startOfWeek, endOfWeek, getDay, isAfter } from 'date-fns';
import { SurahSearchSelect } from '@/components/attendance/SurahSearchSelect';
import { trackActivity } from '@/lib/activityLogger';
import { StatusIndicator } from '@/components/shared/StatusIndicator';
import { UnitInputSelector } from '@/components/attendance/UnitInputSelector';
import { QaidaProgressInput } from '@/components/attendance/QaidaProgressInput';
import { HifzAttendanceFields } from '@/components/attendance/HifzAttendanceFields';
import { NazraAttendanceFields } from '@/components/attendance/NazraAttendanceFields';
import { AcademicAttendanceFields, type LessonStatus, type FollowupSuggestion } from '@/components/attendance/AcademicAttendanceFields';
import { type LearningUnit, type MushafType, convertToLines, LEARNING_UNITS } from '@/lib/quranData';
import { getSubjectType, type SubjectType } from '@/lib/subjectUtils';
import { isRepeatLesson as checkRepeatLesson, type LessonPosition } from '@/lib/quranValidation';
import { type MarkerType } from '@/components/attendance/SabaqSection';
import { MissingAttendanceSection, useMissingAttendanceCount, BYPASS_CUTOFF } from '@/components/attendance/MissingAttendanceSection';
import { UnifiedAttendanceForm } from '@/components/attendance/UnifiedAttendanceForm';

const DAY_NAMES_MAIN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type AttendanceStatus = 'present' | 'student_absent' | 'student_leave' | 'teacher_absent' | 'teacher_leave' | 'rescheduled' | 'student_rescheduled' | 'holiday';
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
  course_id: string | null;
  student?: { full_name: string };
  teacher?: { full_name: string };
  course?: { name: string } | null;
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
  { value: 'student_absent', label: 'Student Absent' },
  { value: 'student_leave', label: 'Student Leave' },
  { value: 'teacher_absent', label: 'Teacher Absent' },
  { value: 'teacher_leave', label: 'Teacher Leave' },
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
  const { activeDivision } = useDivision();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [dateMode, setDateMode] = useState<'month' | 'dateRange'>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'class_date' | 'student_name' | 'teacher_name'>('class_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [unifiedInitialStatus, setUnifiedInitialStatus] = useState<AttendanceStatus>('present');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showMissing, setShowMissing] = useState(searchParams.get('filter') === 'missing');
  
  // Holiday dialog state
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [holidayEndDate, setHolidayEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
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
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole === 'admin_division' ||
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher' || activeRole === 'examiner';
  const isStudent = activeRole === 'student';

  // Statuses that require reason
  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'student_leave', 'teacher_absent', 'teacher_leave'].includes(status);
  
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
        // Admin can see all students with active assignments only (excludes paused/left)
        const { data: activeAssignments } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('status', 'active');

        const activeStudentIds = [...new Set((activeAssignments || []).map(a => a.student_id))];
        if (activeStudentIds.length === 0) return [];

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, mushaf_type, daily_target_lines, preferred_unit, daily_target_amount')
          .in('id', activeStudentIds)
          .order('full_name');
        
        if (error) throw error;
        return (data || []) as Profile[];
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

  // Fetch schedule for selected student in the mark dialog
  const { data: markDialogSchedule } = useQuery({
    queryKey: ['mark-dialog-schedule', selectedStudent, user?.id],
    queryFn: async () => {
      if (!selectedStudent || !user?.id) return null;
      const teacherId = isAdmin ? undefined : user.id;
      
      let query = supabase
        .from('schedules')
        .select(`
          day_of_week,
          teacher_local_time,
          duration_minutes,
          student_teacher_assignments!inner (
            student_id,
            teacher_id
          )
        `)
        .eq('student_teacher_assignments.student_id', selectedStudent)
        .eq('is_active', true);
      
      if (teacherId) {
        query = query.eq('student_teacher_assignments.teacher_id', teacherId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: markDialogOpen && !!selectedStudent && !!user?.id,
  });

  // Check for duplicate attendance in the mark dialog
  const { data: markDialogExisting } = useQuery({
    queryKey: ['mark-dialog-duplicate', selectedStudent, classDate, user?.id],
    queryFn: async () => {
      if (!selectedStudent || !classDate || !user?.id) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('id, class_date, status')
        .eq('student_id', selectedStudent)
        .eq('class_date', classDate)
        .eq('teacher_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: markDialogOpen && !!selectedStudent && !!classDate && !!user?.id,
  });

  const markDialogHasDuplicate = markDialogExisting && markDialogExisting.length > 0;

  // Check if selected date is a scheduled day in mark dialog
  const markDialogScheduledDays = useMemo(() => {
    if (!markDialogSchedule) return [];
    return markDialogSchedule.map(s => s.day_of_week.toLowerCase());
  }, [markDialogSchedule]);

  const isOneToOneDivision = activeDivision?.model_type === 'one_to_one';

  const markDialogIsScheduledDay = useMemo(() => {
    // One-to-one division: weekends/off-days are NEVER frozen.
    if (isOneToOneDivision) return true;
    if (!classDate || markDialogScheduledDays.length === 0) return true;
    const dayIndex = getDay(parseISO(classDate));
    const dayName = DAY_NAMES_MAIN[dayIndex];
    return markDialogScheduledDays.includes(dayName);
  }, [classDate, markDialogScheduledDays, isOneToOneDivision]);

  // Check if selected date is in the future
  const isMarkDateFuture = useMemo(() => {
    if (!classDate) return false;
    const selected = parseISO(classDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isAfter(selected, today);
  }, [classDate]);

  // Auto-fill time from schedule when student or date changes in mark dialog
  useEffect(() => {
    if (markDialogOpen && selectedStudent && classDate && markDialogSchedule) {
      const dayIndex = getDay(parseISO(classDate));
      const dayName = DAY_NAMES_MAIN[dayIndex];
      const schedule = markDialogSchedule.find(s => s.day_of_week.toLowerCase() === dayName);
      if (schedule) {
        setClassTime(schedule.teacher_local_time?.substring(0, 5) || classTime);
        setDuration(schedule.duration_minutes?.toString() || duration);
      }
    }
  }, [markDialogOpen, selectedStudent, classDate, markDialogSchedule]);

  // Missing attendance count for the stat card - enabled for admin AND teacher
  const missingCount = useMissingAttendanceCount(monthFilter, dateMode, dateFrom, dateTo, isAdmin || isTeacher, activeDivision?.id, isTeacher ? user?.id : undefined);

  // Validation
  const isFormValid = useMemo(() => {
    // For teacher leave/absent statuses, don't require student selection
    const isTeacherStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
    
    if (!isTeacherStatus && !selectedStudent) return false;
    if (!classTime) return false;
    
    // Block future dates
    if (isMarkDateFuture) return false;
    
    // Block unscheduled days (only when student is selected and schedule is loaded)
    if (!isTeacherStatus && selectedStudent && markDialogScheduledDays.length > 0 && !markDialogIsScheduledDay) return false;
    
    // Block duplicate attendance
    if (!isTeacherStatus && markDialogHasDuplicate) return false;
    
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
  }, [selectedStudent, selectedStatus, classTime, reasonCategory, reasonText, rescheduleDate, rescheduleTime, needsVarianceReason, varianceReason, surahName, isMarkDateFuture, markDialogIsScheduledDay, markDialogHasDuplicate, markDialogScheduledDays]);

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
    queryKey: ['attendance', user?.id, dateMode, monthFilter, dateFrom, dateTo, activeRole, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      let startDate: string;
      let endDate: string;

      if (dateMode === 'dateRange' && dateFrom && dateTo) {
        startDate = dateFrom;
        endDate = dateTo;
      } else {
        const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
        startDate = format(monthStart, 'yyyy-MM-dd');
        endDate = format(endOfMonth(monthStart), 'yyyy-MM-dd');
      }

      // Apply shared bypass cutoff so all KPI queries use the same effective start
      if (startDate < BYPASS_CUTOFF) startDate = BYPASS_CUTOFF;
      if (endDate < startDate) endDate = startDate;

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
          course_id,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name),
          course:courses!attendance_course_id_fkey(name)
        `)
        .gte('class_date', startDate)
        .lte('class_date', endDate)
        .order('class_date', { ascending: false });

      // Filter by active division
      // Teachers see ALL their own records across divisions (teacher_id filter handles scoping)
      // Other roles are filtered by active division
      if (activeDivision?.id && !isTeacher) {
        query = query.or(`division_id.eq.${activeDivision.id},division_id.is.null`);
      }

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

  // Resolve subject for the record being edited (via student_teacher_assignments).
  // Edit dialog needs subject_name to render the right field tree (Qaida/Hifz/Nazra/Academic).
  const { data: editingSubject } = useQuery({
    queryKey: ['attendance-edit-subject', editingRecord?.student_id, editingRecord?.teacher_id],
    queryFn: async () => {
      if (!editingRecord?.student_id || !editingRecord?.teacher_id) return null;
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('subject_id, subject:subjects(id, name)')
        .eq('student_id', editingRecord.student_id)
        .eq('teacher_id', editingRecord.teacher_id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: editDialogOpen && !!editingRecord?.student_id && !!editingRecord?.teacher_id,
  });

  // Save holiday mutation
  const saveHoliday = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user');
      const { error } = await supabase.from('holidays' as any).insert({
        holiday_date: holidayDate,
        name: holidayName,
        created_by: user.id,
        branch_id: null,
        division_id: activeDivision?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Holiday Saved', description: `${holidayName} on ${holidayDate} marked as holiday` });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedules-count-missing'] });
      queryClient.invalidateQueries({ queryKey: ['missing-attendance'] });
      setHolidayDialogOpen(false);
      setHolidayName('');
      setHolidayDate(format(new Date(), 'yyyy-MM-dd'));
    },
    onError: (e: any) => handleSupabaseError(e, 'save changes'),
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
        division_id: activeDivision?.id || null,
      });

      if (error) throw error;

      // Log reschedule history (best-effort)
      if (requiresReschedule(selectedStatus) && rescheduleDate && user?.id) {
        try {
          await supabase.from('session_reschedules' as any).insert({
            student_id: studentId || user.id,
            teacher_id: user.id,
            original_date: classDate,
            original_time: classTime,
            new_date: rescheduleDate,
            new_time: rescheduleTime || null,
            reason: finalReason || null,
            rescheduled_by: user.id,
          });
        } catch (e) {
          console.warn('[reschedule-history] insert failed', e);
        }
      }
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
      handleSupabaseError(error, 'failed to update');
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
      handleSupabaseError(error, 'failed to delete');
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
    let records = filter === 'all' ? attendanceRecords : attendanceRecords.filter(r => r.status === filter);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r =>
        (r.student?.full_name || '').toLowerCase().includes(q) ||
        (r.teacher?.full_name || '').toLowerCase().includes(q)
      );
    }
    
    // Apply sorting
    records = [...records].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'class_date') {
        cmp = a.class_date.localeCompare(b.class_date);
      } else if (sortBy === 'student_name') {
        cmp = (a.student?.full_name || '').localeCompare(b.student?.full_name || '');
      } else if (sortBy === 'teacher_name') {
        cmp = (a.teacher?.full_name || '').localeCompare(b.teacher?.full_name || '');
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    
    return records;
  }, [attendanceRecords, filter, searchQuery, sortBy, sortOrder]);

  const KNOWN_STATUSES = ['present', 'student_absent', 'student_leave', 'teacher_absent', 'teacher_leave', 'rescheduled', 'student_rescheduled', 'holiday'];

  const stats = useMemo(() => {
    const records = attendanceRecords || [];
    const marked = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const studentAbsent = records.filter(r => r.status === 'student_absent').length;
    const studentLeave = records.filter(r => r.status === 'student_leave').length;
    const teacherOff = records.filter(r => ['teacher_absent', 'teacher_leave'].includes(r.status)).length;
    const rescheduled = records.filter(r => r.status === 'rescheduled' || r.status === 'student_rescheduled').length;
    const holiday = records.filter(r => r.status === 'holiday').length;
    const accountedFor = present + studentAbsent + studentLeave + teacherOff + rescheduled + holiday;
    const other = Math.max(0, marked - accountedFor);
    const otherStatuses = Array.from(new Set(
      records
        .filter(r => !KNOWN_STATUSES.includes(r.status as string) || r.status == null)
        .map(r => (r.status ?? 'null') as string)
    ));
    // Total scheduled = records that exist + scheduled slots with no record (missing)
    const total = marked + (missingCount || 0);
    return { total, marked, present, studentAbsent, studentLeave, teacherOff, rescheduled, holiday, other, otherStatuses };
  }, [attendanceRecords, missingCount]);

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

  const handleSort = (column: 'class_date' | 'student_name' | 'teacher_name') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'class_date' ? 'desc' : 'asc');
    }
  };

  const setThisWeek = () => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    setDateMode('dateRange');
    setDateFrom(format(monday, 'yyyy-MM-dd'));
    setDateTo(format(sunday, 'yyyy-MM-dd'));
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
          {/* Action buttons for Admin and Teacher */}
          {(isAdmin || isTeacher) && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showMissing ? "default" : "outline"}
                className={cn(
                  showMissing && "bg-orange-500 hover:bg-orange-600 text-white"
                )}
                onClick={() => { setShowMissing(!showMissing); if (!showMissing) setFilter('all'); }}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Missing{missingCount > 0 ? ` (${missingCount})` : ''}
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline"
                  onClick={() => setHolidayDialogOpen(true)}
                >
                  <Palmtree className="h-4 w-4 mr-2" />
                  Mark Holiday
                </Button>
              )}
              <Button 
                onClick={() => {
                  setUnifiedInitialStatus('student_leave');
                  setUnifiedOpen(true);
                }}
                variant="outline"
              >
                <UserX className="h-4 w-4 mr-2" />
                Student Leave
              </Button>
              <Button 
                onClick={() => {
                  setUnifiedInitialStatus('rescheduled');
                  setUnifiedOpen(true);
                }}
                variant="outline"
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <Button 
                onClick={() => {
                  setUnifiedInitialStatus('present');
                  setUnifiedOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Mark Attendance
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">

        {/* Stats - Enhanced for Admin */}
        <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 md:grid-cols-7" : isTeacher ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4")}>
          <Card className={cn("text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30", filter === 'all' && !showMissing && "ring-2 ring-primary")} onClick={() => { setFilter('all'); setShowMissing(false); }}>
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Scheduled Classes</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stats.marked} marked + {missingCount || 0} missing</p>
            </CardContent>
          </Card>
          <Card className={cn("bg-emerald-light/10 border-emerald-light/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-emerald-light/30", filter === 'present' && "ring-2 ring-emerald-light")} onClick={() => { setFilter(filter === 'present' ? 'all' : 'present'); setShowMissing(false); }}>
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-emerald-light">{stats.present}</p>
              <p className="text-sm text-emerald-light/80">Present</p>
            </CardContent>
          </Card>
          <Card className={cn("bg-destructive/10 border-destructive/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-destructive/30", filter === 'student_absent' && "ring-2 ring-destructive")} onClick={() => { setFilter(filter === 'student_absent' ? 'all' : 'student_absent'); setShowMissing(false); }}>
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-destructive">{stats.studentAbsent}</p>
              <p className="text-sm text-destructive/80">Student Absent</p>
            </CardContent>
          </Card>
          {stats.studentLeave > 0 && (
            <Card className={cn("bg-amber-500/10 border-amber-500/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-amber-500/30", filter === 'student_leave' && "ring-2 ring-amber-500")} onClick={() => { setFilter(filter === 'student_leave' ? 'all' : 'student_leave'); setShowMissing(false); }}>
              <CardContent className="pt-6">
                <p className="text-2xl font-serif font-bold text-amber-500">{stats.studentLeave}</p>
                <p className="text-sm text-amber-500/80">Student Leave</p>
              </CardContent>
            </Card>
          )}
          {isAdmin && (
            <>
              <Card className={cn("bg-accent/10 border-accent/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-accent/30", (filter === 'teacher_absent' || filter === 'teacher_leave') && "ring-2 ring-accent")} onClick={() => { setFilter(filter === 'teacher_absent' ? 'all' : 'teacher_absent'); setShowMissing(false); }}>
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-accent">{stats.teacherOff}</p>
                  <p className="text-sm text-accent/80">Teacher Off</p>
                </CardContent>
              </Card>
              <Card className={cn("bg-primary/10 border-primary/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30", filter === 'rescheduled' && "ring-2 ring-primary")} onClick={() => { setFilter(filter === 'rescheduled' ? 'all' : 'rescheduled'); setShowMissing(false); }}>
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-primary">{stats.rescheduled}</p>
                  <p className="text-sm text-primary/80">Rescheduled</p>
                </CardContent>
              </Card>
              <Card className={cn("bg-muted text-center cursor-pointer transition-all hover:ring-2 hover:ring-muted-foreground/30", filter === 'holiday' && "ring-2 ring-muted-foreground")} onClick={() => { setFilter(filter === 'holiday' ? 'all' : 'holiday'); setShowMissing(false); }}>
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.holiday}</p>
                  <p className="text-sm text-muted-foreground">Holidays</p>
                </CardContent>
              </Card>
              <Card 
                className={cn(
                  "bg-orange-500/10 border-orange-500/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-orange-500/30",
                  showMissing && "ring-2 ring-orange-500"
                )} 
                onClick={() => { setShowMissing(!showMissing); if (!showMissing) setFilter('all'); }}
              >
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-orange-500">{missingCount}</p>
                  <p className="text-sm text-orange-500/80">Missing</p>
                </CardContent>
              </Card>
              {stats.other > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-muted/50 border-muted text-center cursor-help">
                        <CardContent className="pt-6">
                          <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.other}</p>
                          <p className="text-sm text-muted-foreground">Other</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Unrecognized statuses: {stats.otherStatuses.join(', ') || 'none'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
          {!isAdmin && (
            <>
              <Card className={cn("bg-accent/10 border-accent/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-accent/30", filter === 'rescheduled' && "ring-2 ring-accent")} onClick={() => { setFilter(filter === 'rescheduled' ? 'all' : 'rescheduled'); setShowMissing(false); }}>
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-accent">{stats.rescheduled}</p>
                  <p className="text-sm text-accent/80">Rescheduled</p>
                </CardContent>
              </Card>
              {isTeacher && (
                <Card 
                  className={cn(
                    "bg-orange-500/10 border-orange-500/20 text-center cursor-pointer transition-all hover:ring-2 hover:ring-orange-500/30",
                    showMissing && "ring-2 ring-orange-500"
                  )} 
                  onClick={() => { setShowMissing(!showMissing); if (!showMissing) setFilter('all'); }}
                >
                  <CardContent className="pt-6">
                    <p className="text-2xl font-serif font-bold text-orange-500">{missingCount}</p>
                    <p className="text-sm text-orange-500/80">Missing</p>
                  </CardContent>
                </Card>
              )}
              {stats.other > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-muted/50 border-muted text-center cursor-help">
                        <CardContent className="pt-6">
                          <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.other}</p>
                          <p className="text-sm text-muted-foreground">Other</p>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Unrecognized statuses: {stats.otherStatuses.join(', ') || 'none'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={showMissing ? 'missing' : filter} onValueChange={(val) => {
            if (val === 'missing') {
              setShowMissing(true);
              setFilter('all');
            } else {
              setShowMissing(false);
              setFilter(val);
            }
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
              {isAdmin && <SelectItem value="missing">Missing</SelectItem>}
            </SelectContent>
          </Select>

          {/* Date Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={dateMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateMode('month')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Month
            </Button>
            <Button
              variant={dateMode === 'dateRange' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setDateMode('dateRange');
                if (!dateFrom || !dateTo) {
                  const now = new Date();
                  setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
                  setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
                }
              }}
            >
              <CalendarRange className="h-4 w-4 mr-1" />
              Date Range
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={setThisWeek}
              className="text-primary border-primary/30 hover:bg-primary/10"
            >
              This Week
            </Button>
          </div>

          {/* Month Selector */}
          {dateMode === 'month' && (
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
          )}

          {/* Date Range Inputs */}
          {dateMode === 'dateRange' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          )}
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

        {/* Table - show main records or missing records based on filter */}
        {showMissing ? (
          <MissingAttendanceSection
            monthFilter={monthFilter}
            dateMode={dateMode}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isVisible={true}
            onClose={() => { setShowMissing(false); searchParams.delete('filter'); setSearchParams(searchParams); }}
            teacherId={isTeacher ? user?.id : undefined}
            divisionId={activeDivision?.id}
          />
        ) : (
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
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('class_date')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className={cn("h-3 w-3", sortBy === 'class_date' ? 'text-primary' : 'text-muted-foreground/50')} />
                      </div>
                    </TableHead>
                    {!isStudent && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('student_name')}
                      >
                        <div className="flex items-center gap-1">
                          Student
                          <ArrowUpDown className={cn("h-3 w-3", sortBy === 'student_name' ? 'text-primary' : 'text-muted-foreground/50')} />
                        </div>
                      </TableHead>
                    )}
                    {isAdmin && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('teacher_name')}
                      >
                        <div className="flex items-center gap-1">
                          Teacher
                          <ArrowUpDown className={cn("h-3 w-3", sortBy === 'teacher_name' ? 'text-primary' : 'text-muted-foreground/50')} />
                        </div>
                      </TableHead>
                    )}
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
                          {format(parseISO(record.class_date), 'dd MMM yyyy')}
                        </span>
                      </TableCell>
                      {!isStudent && (
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.student?.full_name || 'Unknown'}</span>
                            {record.course_id && record.course?.name && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {record.course.name}
                              </span>
                            )}
                          </span>
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell>{record.teacher?.full_name || 'Unknown'}</TableCell>
                      )}
                      <TableCell>{record.class_time?.substring(0, 5) || '-'}</TableCell>
                      <TableCell>
                        <StatusIndicator status={record.status} size="md" />
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
                                      Are you sure you want to delete this attendance record for {record.student?.full_name} on {format(parseISO(record.class_date), 'dd MMM yyyy')}? This action cannot be undone.
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
        )}

        </div>

        {/* Unified Mark Attendance — same form as Students tab */}
        <UnifiedAttendanceForm
          open={unifiedOpen}
          onOpenChange={setUnifiedOpen}
          students={(assignedStudents || []).map(s => ({
            id: s.id,
            full_name: s.full_name,
            subject_name: (s as any).subject_name ?? null,
            subject_id: (s as any).subject_id ?? null,
            last_lesson: null,
            daily_target_lines: (s as any).daily_target_lines,
            preferred_unit: (s as any).preferred_unit,
          }))}
          initialStatus={unifiedInitialStatus}
        />

        {/* Phase C: Legacy Mark Attendance dialog removed — UnifiedAttendanceForm above is the single source of truth. */}
        {/* Edit Attendance Dialog — uses the same component tree as Mark form */}
        {editingRecord && (
          <UnifiedAttendanceForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) setEditingRecord(null);
            }}
            mode="edit"
            existingRecord={editingRecord as any}
            student={{
              id: editingRecord.student_id,
              full_name: editingRecord.student?.full_name || '',
              subject_name: editingSubject?.subject?.name || null,
              subject_id: editingSubject?.subject_id || null,
              last_lesson: null,
            }}
            teacherId={editingRecord.teacher_id}
            allowTimeEdit={isAdmin}
            onSuccess={() => {
              setEditDialogOpen(false);
              setEditingRecord(null);
            }}
          />
        )}

        {/* Holiday Dialog */}
        <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Mark Holiday</DialogTitle>
              <DialogDescription>Mark a date as a holiday — all scheduled sessions on this date will be excluded from missing attendance.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Holiday Date</Label>
                <Input type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Holiday Name</Label>
                <Input value={holidayName} onChange={e => setHolidayName(e.target.value)} placeholder="e.g. Eid ul Fitr, Weekend Off" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setHolidayDialogOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-1" 
                  disabled={!holidayName || !holidayDate || saveHoliday.isPending}
                  onClick={() => saveHoliday.mutate()}
                >
                  {saveHoliday.isPending ? 'Saving...' : 'Save Holiday'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
