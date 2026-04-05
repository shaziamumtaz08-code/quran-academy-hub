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
import { Loader2, BookOpen, Clock, User, AlertTriangle, Ban, Calendar } from 'lucide-react';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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
  | 'teacher_absent' 
  | 'teacher_leave' 
  | 'rescheduled' 
  | 'student_rescheduled' 
  | 'holiday';

type ReasonCategory = 'sick' | 'personal' | 'emergency' | 'internet_issue' | 'other';

export const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'student_absent', label: 'Absent' },
  { value: 'teacher_leave', label: 'Leave' },
  { value: 'teacher_absent', label: 'Teacher Absent' },
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

interface UnifiedAttendanceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentInfo;
  teacherId?: string;
  teacherTimezone?: string;
  onSuccess?: () => void;
}

export function UnifiedAttendanceForm({ 
  open, 
  onOpenChange, 
  student,
  teacherId,
  teacherTimezone,
  onSuccess
}: UnifiedAttendanceFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Actual join/leave times (optional)
  const [actualJoinTime, setActualJoinTime] = useState('');
  const [actualLeaveTime, setActualLeaveTime] = useState('');

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

  // Check for duplicate attendance
  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance-check-unified', student.id, classDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, class_date, status')
        .eq('student_id', student.id)
        .eq('class_date', classDate);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!classDate,
  });

  const hasDuplicateAttendance = existingAttendance && existingAttendance.length > 0;

  // Get scheduled days array
  const scheduledDays = useMemo(() => {
    if (!scheduleData) return [];
    return scheduleData.map(s => s.day_of_week.toLowerCase());
  }, [scheduleData]);

  // Check if selected date is a scheduled day
  const isScheduledDay = useMemo(() => {
    if (!classDate || scheduledDays.length === 0) return true;
    const dayIndex = getDay(parseISO(classDate));
    const dayName = DAY_NAMES[dayIndex];
    return scheduledDays.includes(dayName);
  }, [classDate, scheduledDays]);

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

  // Update time when date changes or modal opens
  useEffect(() => {
    if (open && classDate && scheduleData) {
      const scheduleInfo = getScheduledInfoForDay(classDate);
      if (scheduleInfo) {
        const timeStr = scheduleInfo.time.substring(0, 5);
        setClassTime(timeStr);
        setDuration(scheduleInfo.duration.toString());
      }
    }
  }, [open, classDate, scheduleData]);

  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'teacher_absent', 'teacher_leave'].includes(status);

  const requiresReschedule = (status: AttendanceStatus) => 
    ['rescheduled', 'student_rescheduled'].includes(status);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedStatus('present');
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
      setActualJoinTime('');
      setActualLeaveTime('');
      setLessonNumber('');
      setPageNumber('');
      setAyahFromSurah('');
      setAyahFromNumber('');
      setAyahToSurah('');
      setAyahToNumber('');
      setSabqiDone(false);
      setManzilDone(false);
      setAcademicLessonTopic('');
      setAcademicLessonStatus('');
      setAcademicFollowups([]);
    }
  }, [open]);

  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!effectiveTeacherId) throw new Error('Missing teacher');

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
      if (requiresReschedule(selectedStatus) && rescheduleDate && rescheduleTime) {
        finalReason = `Rescheduled to ${rescheduleDate} at ${rescheduleTime}. ${remarks || ''}`.trim();
      }

      const { data, error } = await supabase.from('attendance').insert({
        student_id: student.id,
        teacher_id: effectiveTeacherId,
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
        surah_name: currentSubjectType === 'qaida' ? null : (ayahFromSurah || null),
        ayah_from: currentSubjectType === 'qaida' ? null : (ayahFromNumber ? parseInt(ayahFromNumber) : null),
        ayah_to: currentSubjectType === 'qaida' ? null : (ayahToNumber ? parseInt(ayahToNumber) : null),
        lesson_number: currentSubjectType === 'qaida' && lessonNumber ? parseInt(lessonNumber) : null,
        page_number: currentSubjectType === 'qaida' && pageNumber ? parseInt(pageNumber) : null,
        sabaq_surah_from: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? ayahFromSurah || null : null,
        sabaq_surah_to: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? ayahToSurah || null : null,
        sabaq_ayah_from: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') && ayahFromNumber ? parseInt(ayahFromNumber) : null,
        sabaq_ayah_to: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') && ayahToNumber ? parseInt(ayahToNumber) : null,
        sabqi_done: currentSubjectType === 'hifz' ? sabqiDone : null,
        manzil_done: (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') ? manzilDone : null,
        voice_note_url: voiceNoteUrl || null,
      }).select('id').single();

      if (error) throw error;

      // Track activity
      await trackActivity({
        action: 'attendance_marked',
        entityType: 'attendance',
        entityId: data?.id,
        details: {
          student_name: student.full_name,
          subject: student.subject_name,
          status: selectedStatus,
          class_date: classDate,
        }
      });

      return data;
    },
    onSuccess: () => {
      toast({ title: 'Attendance Marked', description: `Attendance recorded for ${student.full_name}` });
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

  // Check if lesson details are filled for "present" status
  const hasLessonDetails = useMemo(() => {
    if (selectedStatus !== 'present') return true;
    if (currentSubjectType === 'qaida') return !!lessonNumber;
    if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') return !!(ayahFromSurah && ayahFromNumber);
    if (currentSubjectType === 'academic') return !!academicLessonTopic?.trim();
    return true;
  }, [selectedStatus, currentSubjectType, lessonNumber, ayahFromSurah, ayahFromNumber, academicLessonTopic]);

  const isFormValid = useMemo(() => {
    if (!classTime || !classDate) return false;
    if (isFutureDate) return false;
    if (hasDuplicateAttendance) return false;
    if (!isScheduledDay) return false;
    if (requiresReason(selectedStatus) && !reasonCategory) return false;
    if (requiresReason(selectedStatus) && reasonCategory === 'other' && !reasonText.trim()) return false;
    if (requiresReschedule(selectedStatus) && (!rescheduleDate || !rescheduleTime)) return false;
    if (selectedStatus === 'present' && !hasLessonDetails) return false;
    return true;
  }, [selectedStatus, classTime, classDate, reasonCategory, reasonText, rescheduleDate, rescheduleTime, hasDuplicateAttendance, isScheduledDay, isFutureDate, hasLessonDetails]);

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
            Mark Attendance
          </DialogTitle>
          <DialogDescription className="text-sky-200">
            Record attendance for {student.full_name}
          </DialogDescription>
        </DialogHeader>

        {/* Student Info Header */}
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
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as AttendanceStatus)}>
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

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sky-100">Date <span className="text-red-400">*</span></Label>
              <Input 
                type="date" 
                value={classDate} 
                onChange={(e) => setClassDate(e.target.value)} 
                max={format(new Date(), 'yyyy-MM-dd')}
                className="bg-white text-[#1e3a5f] border-0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sky-100">
                Scheduled Time ({teacherTzAbbr}) <span className="text-red-400">*</span>
              </Label>
              <Input 
                type="time" 
                value={classTime} 
                readOnly
                disabled
                className="bg-slate-200 text-[#1e3a5f] border-0 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sky-100">Duration (minutes)</Label>
            <Input 
              type="number" 
              value={duration} 
              readOnly
              disabled
              className="bg-slate-200 text-[#1e3a5f] border-0 cursor-not-allowed"
            />
          </div>

          {/* Actual Join/Leave Times (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sky-100">Actual Join Time (optional)</Label>
              <Input 
                type="time" 
                value={actualJoinTime} 
                onChange={(e) => setActualJoinTime(e.target.value)} 
                className="bg-white text-[#1e3a5f] border-0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sky-100">Actual Leave Time (optional)</Label>
              <Input 
                type="time" 
                value={actualLeaveTime} 
                onChange={(e) => setActualLeaveTime(e.target.value)} 
                className="bg-white text-[#1e3a5f] border-0"
              />
            </div>
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

          {/* Reschedule fields */}
          {requiresReschedule(selectedStatus) && (
            <div className="space-y-4 p-4 bg-[#2d4a6f] rounded-lg">
              <Label className="text-sky-100 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reschedule To
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sky-100">New Date <span className="text-red-400">*</span></Label>
                  <Input 
                    type="date" 
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="bg-white text-[#1e3a5f] border-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sky-100">New Time <span className="text-red-400">*</span></Label>
                  <Input 
                    type="time" 
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="bg-white text-[#1e3a5f] border-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Subject-specific fields - only show when present */}
          {selectedStatus === 'present' && (
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

          {/* Remarks (optional) */}
          <div className="space-y-2">
            <Label className="text-sky-100">Remarks (optional)</Label>
            <Textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes..."
              className="bg-white text-[#1e3a5f] border-0"
            />
          </div>
        </div>

        {/* Lesson details validation warning */}
        {selectedStatus === 'present' && !hasLessonDetails && (
          <Alert className="bg-amber-500/20 border-amber-500/50 text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Lesson details are required when marking attendance as Present.
            </AlertDescription>
          </Alert>
        )}

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
            Mark Attendance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
