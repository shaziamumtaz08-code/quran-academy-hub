import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, BookOpen, Clock, User, AlertTriangle, Ban, Info } from 'lucide-react';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { format, parseISO, getDay, isAfter } from 'date-fns';
import { getSubjectType, type SubjectType } from '@/lib/subjectUtils';
import { QaidaProgressInput } from './QaidaProgressInput';
import { HifzAttendanceFields } from './HifzAttendanceFields';
import { NazraAttendanceFields } from './NazraAttendanceFields';
import { AcademicAttendanceFields, type LessonStatus, type FollowupSuggestion } from './AcademicAttendanceFields';
import { type MarkerType } from './SabaqSection';
import { trackActivity } from '@/lib/activityLogger';
import { getTimezoneAbbr } from '@/lib/timezones';

// Unified status options - comprehensive list
export type AttendanceStatus = 
  | 'present' 
  | 'student_absent' 
  | 'student_leave'
  | 'teacher_absent' 
  | 'teacher_leave' 
  | 'rescheduled' 
  | 'student_rescheduled' 
  | 'holiday';

type ReasonCategory = 'sick' | 'personal' | 'emergency' | 'internet_issue' | 'other';

export const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'student_absent', label: 'Student Absent' },
  { value: 'student_leave', label: 'Student Leave' },
  { value: 'teacher_absent', label: 'Teacher Absent' },
  { value: 'teacher_leave', label: 'Teacher Leave' },
  { value: 'rescheduled', label: 'Rescheduled by Teacher' },
  { value: 'student_rescheduled', label: 'Rescheduled by Student' },
  { value: 'holiday', label: 'Holiday' },
];

const REASON_CATEGORIES: { value: ReasonCategory; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'internet_issue', label: 'Internet Issue' },
  { value: 'other', label: 'Other' },
];

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface StudentInfo {
  id: string;
  full_name: string;
  subject_name: string | null;
  subject_id?: string | null;
  last_lesson: string | null;
  daily_target_lines?: number;
  preferred_unit?: string;
  timezone?: string;
}

/** Shape of an attendance row when editing. Extends create payload with id + nullable progress fields. */
export interface ExistingAttendanceRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  class_date: string;
  class_time: string | null;
  duration_minutes: number;
  status: AttendanceStatus;
  reason: string | null;
  reason_category: string | null;
  reason_text: string | null;
  reschedule_date: string | null;
  reschedule_time: string | null;
  lesson_covered: string | null;
  homework: string | null;
  voice_note_url?: string | null;
  // Sabaq / progress
  sabaq_marker_type?: string | null;
  sabaq_surah_from: string | null;
  sabaq_surah_to: string | null;
  sabaq_ayah_from: number | null;
  sabaq_ayah_to: number | null;
  sabaq_ruku_from_juz?: number | null;
  sabaq_ruku_from_number?: number | null;
  sabaq_ruku_to_juz?: number | null;
  sabaq_ruku_to_number?: number | null;
  sabaq_quarter_from_juz?: number | null;
  sabaq_quarter_from_number?: number | null;
  sabaq_quarter_to_juz?: number | null;
  sabaq_quarter_to_number?: number | null;
  sabqi_done: boolean | null;
  manzil_done: boolean | null;
  lesson_number: number | null;
  page_number: number | null;
  lines_completed: number | null;
  variance_reason: string | null;
  input_unit: string | null;
  raw_input_amount: number | null;
  // Legacy
  surah_name: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  created_at?: string;
}

interface UnifiedAttendanceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'create' (default) inserts a new row; 'edit' updates `existingRecord`. */
  mode?: 'create' | 'edit';
  /** Required when mode='edit'. Source row to hydrate the form. */
  existingRecord?: ExistingAttendanceRecord;
  /** Pre-selected student. If omitted, `students` picker will be shown. */
  student?: StudentInfo;
  /** Optional list of selectable students (used when `student` is not preset). */
  students?: StudentInfo[];
  /** Initial status to start with (e.g. 'teacher_leave' from a quick-action). */
  initialStatus?: AttendanceStatus;
  teacherId?: string;
  teacherTimezone?: string;
  /** When true, Class Time is editable (admins). Defaults to false. */
  allowTimeEdit?: boolean;
  onSuccess?: () => void;
}

export function UnifiedAttendanceForm({ 
  open, 
  onOpenChange, 
  mode = 'create',
  existingRecord,
  student: presetStudent,
  students,
  initialStatus,
  teacherId,
  teacherTimezone,
  allowTimeEdit = false,
  onSuccess
}: UnifiedAttendanceFormProps) {
  const isEdit = mode === 'edit' && !!existingRecord;
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Internal selection (used when no preset student is passed)
  const [pickedStudentId, setPickedStudentId] = useState<string>('');
  const student: StudentInfo = useMemo(() => {
    if (presetStudent) return presetStudent;
    const found = students?.find(s => s.id === pickedStudentId);
    return found || { id: '', full_name: '', subject_name: null, last_lesson: null };
  }, [presetStudent, students, pickedStudentId]);

  const effectiveTeacherId = teacherId || user?.id;
  // Profile timezone not in type yet, use fallback
  const effectiveTeacherTz = teacherTimezone || 'Asia/Karachi';

  // Form state
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState('');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState('30');
  const [homework, setHomework] = useState('');
  const [remarks, setRemarks] = useState('');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  
  // Reason fields
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [reasonText, setReasonText] = useState('');
  
  // Reschedule fields
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');


  // Subject-specific fields
  const [lessonNumber, setLessonNumber] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [markerType, setMarkerType] = useState<MarkerType>('ayah');
  
  // Sabaq fields for Hifz/Nazra
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
  const [sabqiDone, setSabqiDone] = useState(false);
  const [manzilDone, setManzilDone] = useState(false);

  // Edit-only progress fields (Phase A schema). Pre-filled in edit mode, written back on save.
  const [linesCompleted, setLinesCompleted] = useState<string>('');
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [inputUnit, setInputUnit] = useState<string>('');
  const [rawInputAmount, setRawInputAmount] = useState<string>('');

  // Academic fields
  const [academicLessonTopic, setAcademicLessonTopic] = useState('');
  const [academicLessonStatus, setAcademicLessonStatus] = useState<LessonStatus | ''>('');
  const [academicFollowups, setAcademicFollowups] = useState<FollowupSuggestion[]>([]);

  const currentSubjectType: SubjectType = useMemo(() => {
    return getSubjectType(student.subject_name);
  }, [student.subject_name]);

  // Fetch student's schedule
  const { data: scheduleData } = useQuery({
    queryKey: ['student-schedule-unified', student.id, effectiveTeacherId],
    queryFn: async () => {
      if (!effectiveTeacherId) return null;
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          teacher_local_time,
          student_local_time,
          duration_minutes,
          student_teacher_assignments!inner (
            student_id,
            teacher_id
          )
        `)
        .eq('student_teacher_assignments.student_id', student.id)
        .eq('student_teacher_assignments.teacher_id', effectiveTeacherId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!effectiveTeacherId,
  });

  // Check for duplicate attendance (skipped in edit mode — the row being edited is itself the match)
  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance-check-unified', student.id, classDate, isEdit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, class_date, status')
        .eq('student_id', student.id)
        .eq('class_date', classDate);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!classDate && !isEdit,
  });

  const hasDuplicateAttendance = !isEdit && existingAttendance && existingAttendance.length > 0;

  // Get scheduled days array
  const scheduledDays = useMemo(() => {
    if (!scheduleData) return [];
    return scheduleData.map(s => s.day_of_week.toLowerCase());
  }, [scheduleData]);

  const { activeModelType } = useDivision();
  const isOneToOne = activeModelType === 'one_to_one';

  // Check if selected date is a scheduled day.
  // One-to-one division: weekends/off-days are NEVER frozen — teachers can mark any day
  // (covers ad-hoc lessons + reschedules to Sat/Sun).
  const isScheduledDay = useMemo(() => {
    if (isOneToOne) return true;
    if (!classDate || scheduledDays.length === 0) return true;
    const dayIndex = getDay(parseISO(classDate));
    const dayName = DAY_NAMES[dayIndex];
    return scheduledDays.includes(dayName);
  }, [classDate, scheduledDays, isOneToOne]);

  // Get scheduled time for the selected day
  const getScheduledInfoForDay = (date: string) => {
    if (!scheduleData || !date) return null;
    const dayIndex = getDay(parseISO(date));
    const dayName = DAY_NAMES[dayIndex];
    const schedule = scheduleData.find(s => s.day_of_week.toLowerCase() === dayName);
    return schedule ? { 
      time: schedule.teacher_local_time, 
      duration: schedule.duration_minutes,
      studentTime: schedule.student_local_time 
    } : null;
  };

  // Update time when date changes or modal opens (create mode only — edit preserves recorded values)
  useEffect(() => {
    if (isEdit) return;
    if (open && classDate && scheduleData) {
      const scheduleInfo = getScheduledInfoForDay(classDate);
      if (scheduleInfo) {
        const timeStr = scheduleInfo.time.substring(0, 5);
        setClassTime(timeStr);
        setDuration(scheduleInfo.duration.toString());
      }
    }
  }, [open, classDate, scheduleData, isEdit]);

  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'student_leave', 'teacher_absent', 'teacher_leave'].includes(status);

  const requiresReschedule = (status: AttendanceStatus) => 
    ['rescheduled', 'student_rescheduled'].includes(status);

  // Reset/hydrate form on open. Edit mode hydrates from existingRecord; create mode resets to defaults.
  useEffect(() => {
    if (!open) {
      setSelectedStatus(initialStatus || 'present');
      setClassTime('');
      setClassDate(format(new Date(), 'yyyy-MM-dd'));
      setDuration('30');
      setHomework('');
      setRemarks('');
      setVoiceNoteUrl(null);
      setReasonCategory('');
      setReasonText('');
      setRescheduleDate('');
      setRescheduleTime('');
      setLessonNumber('');
      setPageNumber('');
      setMarkerType('ayah');
      setRukuFromJuz(''); setRukuFromNumber(''); setRukuToJuz(''); setRukuToNumber('');
      setQuarterFromJuz(''); setQuarterFromNumber(''); setQuarterToJuz(''); setQuarterToNumber('');
      setAyahFromSurah('');
      setAyahFromNumber('');
      setAyahToSurah('');
      setAyahToNumber('');
      setSabqiDone(false);
      setManzilDone(false);
      setLinesCompleted(''); setVarianceReason(''); setInputUnit(''); setRawInputAmount('');
      setAcademicLessonTopic('');
      setAcademicLessonStatus('');
      setAcademicFollowups([]);
      setPickedStudentId('');
      return;
    }

    // EDIT MODE: hydrate every state from existingRecord
    if (isEdit && existingRecord) {
      const r = existingRecord;
      setSelectedStatus(r.status);
      setClassDate(r.class_date);
      setClassTime(r.class_time ? r.class_time.substring(0, 5) : '');
      setDuration(String(r.duration_minutes ?? 30));
      setHomework(r.homework ?? '');
      setRemarks(r.reason ?? '');
      setVoiceNoteUrl(r.voice_note_url ?? null);
      setReasonCategory((r.reason_category as ReasonCategory) || '');
      setReasonText(r.reason_text ?? '');
      setRescheduleDate(r.reschedule_date ?? '');
      setRescheduleTime(r.reschedule_time ? r.reschedule_time.substring(0, 5) : '');
      setMarkerType(((r.sabaq_marker_type as MarkerType) || 'ayah'));
      // Sabaq surah/ayah — fall back to legacy surah_name/ayah_from for old rows
      setAyahFromSurah(r.sabaq_surah_from ?? r.surah_name ?? '');
      setAyahFromNumber(r.sabaq_ayah_from != null ? String(r.sabaq_ayah_from) : (r.ayah_from != null ? String(r.ayah_from) : ''));
      setAyahToSurah(r.sabaq_surah_to ?? '');
      setAyahToNumber(r.sabaq_ayah_to != null ? String(r.sabaq_ayah_to) : (r.ayah_to != null ? String(r.ayah_to) : ''));
      setRukuFromJuz(r.sabaq_ruku_from_juz != null ? String(r.sabaq_ruku_from_juz) : '');
      setRukuFromNumber(r.sabaq_ruku_from_number != null ? String(r.sabaq_ruku_from_number) : '');
      setRukuToJuz(r.sabaq_ruku_to_juz != null ? String(r.sabaq_ruku_to_juz) : '');
      setRukuToNumber(r.sabaq_ruku_to_number != null ? String(r.sabaq_ruku_to_number) : '');
      setQuarterFromJuz(r.sabaq_quarter_from_juz != null ? String(r.sabaq_quarter_from_juz) : '');
      setQuarterFromNumber(r.sabaq_quarter_from_number != null ? String(r.sabaq_quarter_from_number) : '');
      setQuarterToJuz(r.sabaq_quarter_to_juz != null ? String(r.sabaq_quarter_to_juz) : '');
      setQuarterToNumber(r.sabaq_quarter_to_number != null ? String(r.sabaq_quarter_to_number) : '');
      setSabqiDone(!!r.sabqi_done);
      setManzilDone(!!r.manzil_done);
      setLessonNumber(r.lesson_number != null ? String(r.lesson_number) : '');
      setPageNumber(r.page_number != null ? String(r.page_number) : '');
      setLinesCompleted(r.lines_completed != null ? String(r.lines_completed) : '');
      setVarianceReason(r.variance_reason ?? '');
      setInputUnit(r.input_unit ?? '');
      setRawInputAmount(r.raw_input_amount != null ? String(r.raw_input_amount) : '');
      setAcademicLessonTopic(r.lesson_covered ?? '');
      return;
    }

    if (initialStatus) setSelectedStatus(initialStatus);
  }, [open, initialStatus, isEdit, existingRecord]);

  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!effectiveTeacherId) throw new Error('Missing teacher');

      // For teacher-only / holiday statuses with no preset student, fall back to first
      // student in the picker list so the row still records (legacy behaviour).
      let resolvedStudentId = student.id;
      if (!resolvedStudentId && isTeacherOnlyStatus && students && students.length > 0) {
        resolvedStudentId = students[0].id;
      }
      if (!resolvedStudentId) throw new Error('Please select a student');

      // Build lesson_covered based on subject type
      let lessonCoveredText = '';
      if (currentSubjectType === 'qaida') {
        lessonCoveredText = lessonNumber ? `Lesson ${lessonNumber}${pageNumber ? `, Page ${pageNumber}` : ''}` : '';
      } else if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') {
        if (ayahFromSurah && ayahFromNumber) {
          lessonCoveredText = `${ayahFromSurah} ${ayahFromNumber}`;
          if (ayahToSurah && ayahToNumber) {
            lessonCoveredText += ` - ${ayahToSurah} ${ayahToNumber}`;
          }
        }
      } else {
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

      let finalReason = remarks || '';
      if (requiresReschedule(selectedStatus) && rescheduleDate) {
        finalReason = `Make-up for missed class on ${rescheduleDate}${rescheduleTime ? ` at ${rescheduleTime}` : ''}. ${remarks || ''}`.trim();
      }

      // Build the full payload. In edit mode we always write the Phase A superset
      // so progress fields edited in the dialog actually persist.
      const isHifzOrNazra = currentSubjectType === 'hifz' || currentSubjectType === 'nazra';
      const isQaida = currentSubjectType === 'qaida';

      const basePayload: Record<string, any> = {
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
        surah_name: isQaida ? null : (ayahFromSurah || null),
        ayah_from: isQaida ? null : (ayahFromNumber ? parseInt(ayahFromNumber) : null),
        ayah_to: isQaida ? null : (ayahToNumber ? parseInt(ayahToNumber) : null),
        lesson_number: isQaida && lessonNumber ? parseInt(lessonNumber) : null,
        page_number: isQaida && pageNumber ? parseInt(pageNumber) : null,
        sabaq_surah_from: isHifzOrNazra ? ayahFromSurah || null : null,
        sabaq_surah_to: isHifzOrNazra ? ayahToSurah || null : null,
        sabaq_ayah_from: isHifzOrNazra && ayahFromNumber ? parseInt(ayahFromNumber) : null,
        sabaq_ayah_to: isHifzOrNazra && ayahToNumber ? parseInt(ayahToNumber) : null,
        sabqi_done: currentSubjectType === 'hifz' ? sabqiDone : null,
        manzil_done: isHifzOrNazra ? manzilDone : null,
        voice_note_url: voiceNoteUrl || null,
      };

      // Phase A columns — written on both create and edit (no-op when null on legacy rows)
      const phaseAPayload: Record<string, any> = {
        sabaq_marker_type: isHifzOrNazra ? markerType : null,
        sabaq_ruku_from_juz: isHifzOrNazra && rukuFromJuz ? parseInt(rukuFromJuz) : null,
        sabaq_ruku_from_number: isHifzOrNazra && rukuFromNumber ? parseInt(rukuFromNumber) : null,
        sabaq_ruku_to_juz: isHifzOrNazra && rukuToJuz ? parseInt(rukuToJuz) : null,
        sabaq_ruku_to_number: isHifzOrNazra && rukuToNumber ? parseInt(rukuToNumber) : null,
        sabaq_quarter_from_juz: isHifzOrNazra && quarterFromJuz ? parseInt(quarterFromJuz) : null,
        sabaq_quarter_from_number: isHifzOrNazra && quarterFromNumber ? parseInt(quarterFromNumber) : null,
        sabaq_quarter_to_juz: isHifzOrNazra && quarterToJuz ? parseInt(quarterToJuz) : null,
        sabaq_quarter_to_number: isHifzOrNazra && quarterToNumber ? parseInt(quarterToNumber) : null,
        lines_completed: linesCompleted ? parseInt(linesCompleted) : null,
        variance_reason: varianceReason || null,
        input_unit: inputUnit || null,
        raw_input_amount: rawInputAmount ? parseFloat(rawInputAmount) : null,
      };

      let savedId: string | undefined;

      if (isEdit && existingRecord) {
        const { error } = await supabase
          .from('attendance')
          .update({ ...basePayload, ...phaseAPayload })
          .eq('id', existingRecord.id);
        if (error) throw error;
        savedId = existingRecord.id;
      } else {
        const insertPayload: any = {
          student_id: resolvedStudentId,
          teacher_id: effectiveTeacherId,
          ...basePayload,
          ...phaseAPayload,
        };
        const { data, error } = await supabase.from('attendance').insert(insertPayload).select('id').single();
        if (error) throw error;
        savedId = data?.id;
      }

      // Log reschedule history (best-effort; never blocks the save). Create-mode only —
      // edits don't fork a new reschedule record.
      if (!isEdit && requiresReschedule(selectedStatus) && rescheduleDate && user?.id) {
        try {
          await supabase.from('session_reschedules' as any).insert({
            attendance_id: savedId,
            student_id: resolvedStudentId,
            teacher_id: effectiveTeacherId,
            original_date: rescheduleDate,
            original_time: rescheduleTime || null,
            new_date: classDate,
            new_time: classTime || null,
            reason: remarks || null,
            rescheduled_by: user.id,
          });
        } catch (e) {
          console.warn('[reschedule-history] insert failed', e);
        }
      }

      // Track activity
      await trackActivity({
        action: isEdit ? 'attendance_updated' : 'attendance_marked',
        entityType: 'attendance',
        entityId: savedId,
        details: {
          student_name: student.full_name,
          subject: student.subject_name,
          status: selectedStatus,
          class_date: classDate,
          rescheduled_to: requiresReschedule(selectedStatus) ? rescheduleDate : null,
        }
      });

      return { id: savedId };
    },
    onSuccess: () => {
      toast({
        title: isEdit ? 'Attendance Updated' : 'Attendance Marked',
        description: isEdit
          ? `Updated record for ${student.full_name}`
          : `Attendance recorded for ${student.full_name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students-detailed'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  const isFutureDate = useMemo(() => {
    if (!classDate) return false;
    const selected = parseISO(classDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isAfter(selected, today);
  }, [classDate]);

  // Check if lesson details are filled for "present" or rescheduled statuses
  // (rescheduled = the make-up class actually happened, so lesson coverage required)
  const lessonRequired = selectedStatus === 'present' || requiresReschedule(selectedStatus);
  const hasLessonDetails = useMemo(() => {
    if (!lessonRequired) return true;
    if (currentSubjectType === 'qaida') return !!lessonNumber;
    if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') return !!(ayahFromSurah && ayahFromNumber);
    if (currentSubjectType === 'academic') return !!academicLessonTopic?.trim();
    return true;
  }, [lessonRequired, currentSubjectType, lessonNumber, ayahFromSurah, ayahFromNumber, academicLessonTopic]);

  const isTeacherOnlyStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
  const needsStudent = !isTeacherOnlyStatus;

  const isFormValid = useMemo(() => {
    if (!classTime || !classDate) return false;
    if (isFutureDate) return false;
    if (needsStudent && !student.id) return false;
    if (hasDuplicateAttendance) return false;
    if (!isScheduledDay) return false;
    if (requiresReason(selectedStatus) && !reasonCategory) return false;
    if (requiresReason(selectedStatus) && reasonCategory === 'other' && !reasonText.trim()) return false;
    if (requiresReschedule(selectedStatus) && !rescheduleDate) return false;
    if (lessonRequired && !hasLessonDetails) return false;
    return true;
  }, [selectedStatus, classTime, classDate, reasonCategory, reasonText, rescheduleDate, hasDuplicateAttendance, isScheduledDay, isFutureDate, lessonRequired, hasLessonDetails, needsStudent, student.id]);

  const studentTzAbbr = getTimezoneAbbr(student.timezone);
  const teacherTzAbbr = getTimezoneAbbr(effectiveTeacherTz);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1e3a5f] border-[#2d4a6f] text-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-sky/20 flex items-center justify-center">
              <User className="h-5 w-5 text-sky-300" />
            </div>
            {isEdit ? 'Edit Attendance' : 'Mark Attendance'}
          </DialogTitle>
          <DialogDescription className="text-sky-200">
            {isEdit
              ? <>
                  {student.full_name ? `Edit attendance for ${student.full_name}` : 'Edit attendance record'}
                  {existingRecord?.created_at && (
                    <span className="block text-xs text-sky-200/70 mt-1">
                      Created: {format(parseISO(existingRecord.created_at), 'dd MMM yyyy h:mm a')}
                    </span>
                  )}
                </>
              : (student.full_name ? `Record attendance for ${student.full_name}` : 'Record attendance for a class')}
          </DialogDescription>
        </DialogHeader>

        {/* Student Picker (when no preset) */}
        {!presetStudent && students && students.length > 0 && needsStudent && (
          <div className="bg-[#2d4a6f] rounded-xl p-4 space-y-2">
            <Label className="text-sky-100">Student <span className="text-red-400">*</span></Label>
            <Select value={pickedStudentId} onValueChange={setPickedStudentId}>
              <SelectTrigger className="bg-white text-[#1e3a5f] border-0">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}{s.subject_name ? ` — ${s.subject_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Student Info Header (when student is known) */}
        {student.id && needsStudent && (
          <div className="bg-[#2d4a6f] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-lg">{student.full_name}</span>
              {student.subject_name && (
                <Badge className="bg-sky/20 text-sky-200 border-sky/30">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {student.subject_name}
                </Badge>
              )}
            </div>
            {student.last_lesson && (
              <div className="text-sm text-sky-200">
                <Clock className="h-3 w-3 inline mr-1" />
                Last: {student.last_lesson}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Duplicate Attendance Warning */}
          {hasDuplicateAttendance && (
            <Alert className="bg-red-500/20 border-red-500/50 text-red-200">
              <Ban className="h-4 w-4" />
              <AlertDescription>
                Attendance already marked for {format(parseISO(classDate), 'dd MMM yyyy')}.
              </AlertDescription>
            </Alert>
          )}

          {/* Non-Scheduled Day Warning */}
          {!isScheduledDay && !hasDuplicateAttendance && !isFutureDate && (
            <Alert className="bg-amber-500/20 border-amber-500/50 text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is not a scheduled day. Scheduled: {scheduledDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'None'}.
              </AlertDescription>
            </Alert>
          )}

          {/* Future Date Warning */}
          {isFutureDate && (
            <Alert className="bg-red-500/20 border-red-500/50 text-red-200">
              <Ban className="h-4 w-4" />
              <AlertDescription>
                Cannot mark attendance for future dates.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Selection */}
          <div className="space-y-2">
            <Label className="text-sky-100">Status <span className="text-red-400">*</span></Label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => {
                const next = v as AttendanceStatus;
                // Silently clear reschedule fields when leaving a reschedule status
                if (!requiresReschedule(next)) {
                  setRescheduleDate('');
                  setRescheduleTime('');
                }
                setSelectedStatus(next);
              }}
            >
              <SelectTrigger className="bg-white text-[#1e3a5f] border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adaptive Date Block ---------------------------------------- */}
          {!requiresReschedule(selectedStatus) ? (
            // Variant A — non-reschedule statuses: single Date + Scheduled Time row
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sky-100">Class Date <span className="text-red-400">*</span></Label>
                <Input
                  type="date"
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sky-100">
                  Scheduled Time ({teacherTzAbbr}) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="time"
                  value={classTime}
                  onChange={(e) => setClassTime(e.target.value)}
                  readOnly={!allowTimeEdit}
                  disabled={!allowTimeEdit}
                  className={allowTimeEdit
                    ? "bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    : "bg-slate-200 text-[#1e3a5f] border-0 cursor-not-allowed [&::-webkit-calendar-picker-indicator]:opacity-0"}
                />
              </div>
            </div>
          ) : (
            // Variant B — reschedule statuses: contained block, "Originally scheduled" first, "Actually conducted on" second
            <div className="rounded-lg bg-[#2d4a6f] p-3 sm:p-4 space-y-4">
              {/* Info banner (blue, not amber — reschedule is routine) */}
              <div className="flex items-start gap-2 rounded-md bg-sky-500/15 border border-sky-400/30 px-3 py-2">
                <Info className="h-4 w-4 text-sky-300 mt-0.5 shrink-0" />
                <div className="text-sm text-sky-100">
                  <span className="font-medium">Reschedule details</span>
                  <span className="block text-xs text-sky-200/80">This class is a make-up for a missed slot.</span>
                </div>
              </div>

              {/* Sub-section 1: Originally scheduled (FIRST) */}
              <div className="space-y-2">
                <Label className="text-sky-100 text-sm font-semibold">Originally scheduled</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sky-100 text-xs">Date <span className="text-red-400">*</span></Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      min={format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sky-100 text-xs">Time</Label>
                    <Input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-sky-200/70">Pick the missed scheduled day this class makes up for.</p>
              </div>

              {/* Thin divider — no text label */}
              <div className="h-px bg-sky-200/15" />

              {/* Sub-section 2: Actually conducted on (SECOND) */}
              <div className="space-y-2">
                <Label className="text-sky-100 text-sm font-semibold">Actually conducted on</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sky-100 text-xs">Date <span className="text-red-400">*</span></Label>
                    <Input
                      type="date"
                      value={classDate}
                      onChange={(e) => setClassDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sky-100 text-xs">Time ({teacherTzAbbr}) <span className="text-red-400">*</span></Label>
                    <Input
                      type="time"
                      value={classTime}
                      onChange={(e) => setClassTime(e.target.value)}
                      className="bg-white text-[#1e3a5f] border-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-sky-200/70">Can be any day, including weekends.</p>
              </div>
            </div>
          )}

          {/* Duration — fixed position, always visible. Editable when reschedule (off-roster). */}
          <div className="space-y-2">
            <Label className="text-sky-100">Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              readOnly={!requiresReschedule(selectedStatus)}
              disabled={!requiresReschedule(selectedStatus)}
              className={requiresReschedule(selectedStatus)
                ? "bg-white text-[#1e3a5f] border-0"
                : "bg-slate-200 text-[#1e3a5f] border-0 cursor-not-allowed"}
            />
          </div>

          {/* Reason fields for absent status */}
          {requiresReason(selectedStatus) && (
            <div className="space-y-4 p-4 bg-[#2d4a6f] rounded-lg">
              <div className="space-y-2">
                <Label className="text-sky-100">Reason Category <span className="text-red-400">*</span></Label>
                <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCategory)}>
                  <SelectTrigger className="bg-white text-[#1e3a5f] border-0">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_CATEGORIES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reasonCategory === 'other' && (
                <div className="space-y-2">
                  <Label className="text-sky-100">Specify Reason <span className="text-red-400">*</span></Label>
                  <Textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="bg-white text-[#1e3a5f] border-0"
                    placeholder="Please specify..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Subject-specific fields — show when class actually happened (present or rescheduled) */}
          {lessonRequired && (
            <div className="space-y-4">
              {currentSubjectType === 'qaida' && (
                <QaidaProgressInput
                  lessonNumber={lessonNumber}
                  onLessonNumberChange={setLessonNumber}
                  pageNumber={pageNumber}
                  onPageNumberChange={setPageNumber}
                />
              )}

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
                />
              )}

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
                />
              )}

              {currentSubjectType === 'academic' && (
                <AcademicAttendanceFields
                  lessonTopic={academicLessonTopic}
                  onLessonTopicChange={setAcademicLessonTopic}
                  lessonStatus={academicLessonStatus}
                  onLessonStatusChange={(v) => setAcademicLessonStatus(v)}
                  homework={homework}
                  onHomeworkChange={setHomework}
                  followupSuggestions={academicFollowups}
                  onFollowupSuggestionsChange={setAcademicFollowups}
                />
              )}

              {/* Inline lesson-details validation error — appears directly under the offending fields */}
              {lessonRequired && !hasLessonDetails && (
                <p className="text-xs text-red-300 flex items-center gap-1.5 -mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Lesson details are required when the class was conducted.
                </p>
              )}

              {/* Homework - if not academic (academic includes it) */}
              {currentSubjectType !== 'academic' && (
                <div className="space-y-2">
                  <Label className="text-sky-100">Homework</Label>
                  <Textarea 
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    placeholder="Enter homework assignment..."
                    className="bg-white text-[#1e3a5f] border-0"
                  />
                </div>
              )}
            </div>
          )}

          {/* Voice Note */}
          <VoiceNoteRecorder
            onUploadComplete={setVoiceNoteUrl}
            uploadPath={`${student.id}/${classDate}`}
          />

          {/* Remarks */}
          <div className="space-y-2">
            <Label className="text-sky-100">Remarks</Label>
            <Textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes..."
              className="bg-white text-[#1e3a5f] border-0"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[#2d4a6f]">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-sky/30 text-sky-200 hover:bg-[#2d4a6f]"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => markAttendance.mutate()}
            disabled={!isFormValid || markAttendance.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {markAttendance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Mark Attendance'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
