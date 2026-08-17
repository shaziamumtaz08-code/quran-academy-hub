import React, { useState, useMemo, useEffect } from 'react';
import { getSurahByName } from '@/lib/quranData';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SegmentedControl } from './SegmentedControl';
import { Loader2, BookOpen, Clock, User, AlertTriangle, Ban, Info, CheckCircle2, XCircle, CalendarClock, PauseCircle } from 'lucide-react';
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
import {
  formatLessonSegments,
  segmentFromDbRow,
  segmentToDbRow,
  isSegmentComplete,
  type LessonSegment,
} from '@/lib/lessonFormat';

import { LessonTypeSection, type LessonType, type RepeatReason } from './LessonTypeSection';
import { trackActivity } from '@/lib/activityLogger';
import { getTimezoneAbbr } from '@/lib/timezones';
import { cn } from '@/lib/utils';

import { useQaidaReference } from '@/hooks/useQaidaProgress';

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

type ReasonCategory = string;
type RescheduleReason = 'teacher_unavailable' | 'student_unavailable' | 'tech_issue' | 'power_outage' | 'emergency' | 'holiday_overlap' | 'other';

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

type ReasonOption = { value: ReasonCategory; label: string; femaleOnly?: boolean };

/** Label lookup for any legacy value that may exist in older records. */
const REASON_LABELS: Record<string, string> = {
  sick: 'Sick / unwell',
  personal: 'Personal',
  emergency: 'Emergency',
  family: 'Family matter',
  travel: 'Travel',
  internet_issue: 'Internet issue',
  power_outage: 'Power outage / load-shedding',
  periods: 'Periods',
  school_exam: 'School / college exams',
  religious: 'Religious occasion',
  medical_appointment: 'Medical appointment',
  no_response: 'No response / did not join',
  overslept: 'Overslept / woke up late',
  guests: 'Guests at home',
  other: 'Other',
};

const opt = (value: string, femaleOnly?: boolean): ReasonOption => ({
  value,
  label: REASON_LABELS[value] || value,
  femaleOnly,
});

/** Reason lists differ per status — restored from the legacy attendance forms. */
const REASONS_BY_STATUS: Record<string, ReasonOption[]> = {
  student_absent: [
    opt('sick'), opt('personal'), opt('emergency'), opt('family'),
    opt('travel'), opt('internet_issue'), opt('power_outage'),
    opt('no_response'), opt('overslept'), opt('school_exam'),
    opt('periods', true), opt('other'),
  ],
  student_leave: [
    opt('sick'), opt('personal'), opt('emergency'), opt('family'),
    opt('travel'), opt('school_exam'), opt('religious'),
    opt('periods', true), opt('other'),
  ],
  teacher_absent: [
    opt('sick'), opt('personal'), opt('emergency'), opt('family'),
    opt('internet_issue'), opt('power_outage'), opt('other'),
  ],
  teacher_leave: [
    opt('sick'), opt('personal'), opt('emergency'), opt('family'),
    opt('travel'), opt('medical_appointment'), opt('religious'),
    opt('guests'), opt('other'),
  ],
};

const RESCHEDULE_REASONS: { value: RescheduleReason; label: string }[] = [
  { value: 'teacher_unavailable', label: 'Teacher Unavailable' },
  { value: 'student_unavailable', label: 'Student Unavailable' },
  { value: 'tech_issue', label: 'Technical Issue' },
  { value: 'power_outage', label: 'Power Outage' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'holiday_overlap', label: 'Holiday Overlap' },
  { value: 'other', label: 'Other' },
];

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface StudentInfo {
  id: string;
  full_name: string;
  subject_name: string | null;
  subject_id?: string | null;
  assignment_id?: string | null;
  last_lesson: string | null;
  daily_target_lines?: number;
  preferred_unit?: string;
  timezone?: string;
  gender?: string | null;
  /** Teacher assigned to this student (used when an admin marks on a teacher's behalf). */
  teacher_id?: string | null;
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
  /** Pre-selected class date (yyyy-MM-dd), e.g. when marking a specific missed slot. */
  initialDate?: string;
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
  initialDate,
  teacherId,
  teacherTimezone,
  allowTimeEdit = false,
  onSuccess
}: UnifiedAttendanceFormProps) {
  // A teacher who lands on an already-marked slot can switch this dialog into edit
  // mode in place, instead of hitting a dead end.
  const [switchEditId, setSwitchEditId] = useState<string | null>(null);
  const { data: switchedRecord } = useQuery({
    queryKey: ['attendance-switch-to-edit', switchEditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('id', switchEditId as string)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ExistingAttendanceRecord;
    },
    enabled: !!switchEditId,
  });
  const activeRecord = existingRecord ?? switchedRecord ?? undefined;
  const isEdit = (mode === 'edit' || !!switchedRecord) && !!activeRecord;
  useEffect(() => {
    if (!open) setSwitchEditId(null);
  }, [open]);
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

  const effectiveTeacherId = teacherId || student.teacher_id || user?.id;
  // Profile timezone not in type yet, use fallback
  const effectiveTeacherTz = teacherTimezone || 'Asia/Karachi';

  // Form state
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState('');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState('30');
  const [remarks, setRemarks] = useState('');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  
  // Reason fields
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [reasonText, setReasonText] = useState('');
  
  // Reschedule fields
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleBy, setRescheduleBy] = useState<'teacher' | 'student'>('teacher');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Leave date range (for student_leave / teacher_leave when applicable)
  const [leaveEndDate, setLeaveEndDate] = useState('');


  // Subject-specific fields
  const [lessonNumber, setLessonNumber] = useState('');
  const { data: qaidaRef } = useQaidaReference();
  const [pageNumber, setPageNumber] = useState('');
  const [qaidaPageId, setQaidaPageId] = useState('');
  const [qaidaBaabId, setQaidaBaabId] = useState('');
  const [qaidaWordFromId, setQaidaWordFromId] = useState('');
  const [qaidaWordToId, setQaidaWordToId] = useState('');
  const [qaidaUnitFrom, setQaidaUnitFrom] = useState('');
  const [qaidaUnitTo, setQaidaUnitTo] = useState('');
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
  // Whole-Juz marking (Hifz only)
  const [juzFrom, setJuzFrom] = useState('');
  const [juzTo, setJuzTo] = useState('');
  // Additional lesson segments (non-contiguous portions covered in the same sitting)
  const [extraSegments, setExtraSegments] = useState<LessonSegment[]>([]);

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

  // Lesson-type (new vs repeat) + reason — applies to all subject types
  const [lessonType, setLessonType] = useState<LessonType>('new');
  const [repeatReason, setRepeatReason] = useState<RepeatReason | ''>('');
  const [repeatReasonNote, setRepeatReasonNote] = useState('');
  // Manzil Yes/No must be explicitly answered for Hifz/Nazra
  const [manzilAnswered, setManzilAnswered] = useState(false);

  // Resolve the authoritative assignment. Besides repairing missing caller data,
  // this gives schedule lookup a direct assignment_id and avoids fragile embedded
  // relationship filters that can return no rows under teacher RLS.
  const { data: resolvedAssignment } = useQuery({
    queryKey: ['attendance-assignment-resolve', student.id, student.assignment_id, effectiveTeacherId],
    queryFn: async () => {
      if (!student.id) return null;
      let q = supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, teacher_timezone, subject_id, subject:subjects(name), status, created_at')
        .eq('student_id', student.id)
        .in('status', ['active', 'on_hold'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (student.assignment_id) q = q.eq('id', student.assignment_id);
      else if (effectiveTeacherId) q = q.eq('teacher_id', effectiveTeacherId);
      let { data, error } = await q;
      if (error) throw error;
      if (!data?.length && effectiveTeacherId) {
        // No row for this teacher (e.g. admin marking on behalf) — fall back to any active assignment.
        const res = await supabase
          .from('student_teacher_assignments')
          .select('id, teacher_id, teacher_timezone, subject_id, subject:subjects(name), status, created_at')
          .eq('student_id', student.id)
          .in('status', ['active', 'on_hold'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (res.error) throw res.error;
        data = res.data as any;
      }
      return (data?.[0] as any) ?? null;
    },
    enabled: open && !!student.id,
    staleTime: 5 * 60 * 1000,
  });

  // The assignment is authoritative. A stale/null subject supplied by a caller
  // must never force a Quran student into the generic academic form.
  const resolvedSubjectName = resolvedAssignment?.subject?.name || student.subject_name || null;
  const resolvedAssignmentId = student.assignment_id || resolvedAssignment?.id || null;
  const resolvedTeacherId = student.teacher_id || resolvedAssignment?.teacher_id || teacherId || user?.id;

  const currentSubjectType: SubjectType = useMemo(() => {
    return getSubjectType(resolvedSubjectName);
  }, [resolvedSubjectName]);


  // Fetch student gender (for conditional reason options like Periods)
  const { data: studentProfile } = useQuery({
    queryKey: ['student-gender', student.id],
    queryFn: async () => {
      if (!student.id) return null;
      const { data } = await supabase.from('profiles').select('gender').eq('id', student.id).maybeSingle();
      return data;
    },
    enabled: open && !!student.id,
  });
  const studentGender = (student.gender || (studentProfile as any)?.gender || '').toString().toLowerCase();
  const visibleReasonCategories = useMemo(() => {
    const base = (REASONS_BY_STATUS[selectedStatus] || REASONS_BY_STATUS.student_absent)
      .filter(r => !r.femaleOnly || studentGender === 'female');
    // Keep any legacy value already saved on the record selectable.
    if (reasonCategory && !base.some(r => r.value === reasonCategory)) {
      return [...base, { value: reasonCategory, label: REASON_LABELS[reasonCategory] || reasonCategory }];
    }
    return base;
  }, [studentGender, selectedStatus, reasonCategory]);

  // Sync rescheduleBy with selected status
  useEffect(() => {
    if (selectedStatus === 'rescheduled') setRescheduleBy('teacher');
    else if (selectedStatus === 'student_rescheduled') setRescheduleBy('student');
  }, [selectedStatus]);

  // Drop a reason that isn't offered for the newly selected status
  useEffect(() => {
    if (!reasonCategory) return;
    const list = REASONS_BY_STATUS[selectedStatus];
    if (list && !list.some(r => r.value === reasonCategory)) setReasonCategory('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);


  // Fetch student's schedule
  const { data: scheduleData } = useQuery({
    queryKey: ['student-schedule-unified', student.id, resolvedAssignmentId],
    queryFn: async () => {
      if (!resolvedAssignmentId) return [];
      
      const { data, error } = await supabase
        .from('schedules')
        .select('id, day_of_week, teacher_local_time, student_local_time, duration_minutes')
        .eq('assignment_id', resolvedAssignmentId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!student.id && !!resolvedAssignmentId,
  });

  // Check for duplicate attendance at the SAME date+time+teacher (matches the DB
  // duplicate-guard trigger). Skipped in edit mode — the row being edited is itself
  // the match.
  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance-check-unified', student.id, classDate, classTime, resolvedTeacherId, isEdit],
    queryFn: async () => {
      let q = supabase
        .from('attendance')
        .select('id, class_date, class_time, status')
        .eq('student_id', student.id)
        .eq('class_date', classDate);
      if (classTime) q = q.eq('class_time', classTime);
      if (resolvedTeacherId) q = q.eq('teacher_id', resolvedTeacherId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open && !!classDate && !isEdit,
    staleTime: 0,
  });

  const hasDuplicateAttendance = !isEdit && existingAttendance && existingAttendance.length > 0;

  // Academy holidays / off days — attendance must not be marked on these by default.
  const { data: holidayRow } = useQuery({
    queryKey: ['attendance-holiday-check', classDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays' as any)
        .select('holiday_date, name')
        .eq('holiday_date', classDate)
        .maybeSingle();
      if (error) return null;
      return data as unknown as { holiday_date: string; name: string } | null;
    },
    enabled: open && !!classDate,
  });
  const isHolidayDate = !!holidayRow;

  // Recent holidays, used so the date choices never land on an off day.
  const { data: recentHolidays } = useQuery({
    queryKey: ['attendance-recent-holidays'],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 70);
      const { data } = await supabase
        .from('holidays' as any)
        .select('holiday_date')
        .gte('holiday_date', format(from, 'yyyy-MM-dd'));
      return ((data || []) as unknown as { holiday_date: string }[]).map(h => h.holiday_date);
    },
    enabled: open,
  });
  const recentHolidaySet = useMemo(() => new Set(recentHolidays || []), [recentHolidays]);




  // Fetch the student's most recent prior attendance with lesson coverage — used to
  // (1) display "Last lesson" inside the Lesson Type card and (2) auto-fill Sabaq/topic
  // when the teacher picks "Same as last class".
  const { data: previousLesson } = useQuery({
    queryKey: ['prev-attendance-lesson', student.id, classDate, isEdit ? activeRecord?.id : null],
    queryFn: async () => {
      if (!student.id) return null;
      let q = supabase
        .from('attendance')
        .select('id, class_date, lesson_covered, sabaq_marker_type, sabaq_surah_from, sabaq_surah_to, sabaq_ayah_from, sabaq_ayah_to, sabaq_ruku_from_juz, sabaq_ruku_from_number, sabaq_ruku_to_juz, sabaq_ruku_to_number, sabaq_quarter_from_juz, sabaq_quarter_from_number, sabaq_quarter_to_juz, sabaq_quarter_to_number, lesson_number, page_number, qaida_page_id, qaida_baab_id, qaida_word_from_id, qaida_word_to_id, qaida_unit_from, qaida_unit_to')
        .eq('student_id', student.id)
        .eq('status', 'present')
        .lt('class_date', classDate || format(new Date(), 'yyyy-MM-dd'))
        .order('class_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (isEdit && activeRecord?.id) q = q.neq('id', activeRecord.id);
      const { data, error } = await q;
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: open && !!student.id,
  });

  // Where this student stopped last class — the Quran page view opens right there.
  const resumeAyah = React.useMemo(() => {
    const p: any = previousLesson;
    const surah = p?.sabaq_surah_to || p?.sabaq_surah_from;
    const ayah = p?.sabaq_ayah_to ?? p?.sabaq_ayah_from;
    const num = getSurahByName(surah || '')?.number;
    if (!num || !ayah) return null;
    return { surah: num, ayah: Number(ayah) };
  }, [previousLesson]);


  // When user switches to "repeat", prefill the lesson fields from the previous class.
  const applyPreviousLesson = () => {
    if (!previousLesson) return;
    const p: any = previousLesson;
    if (currentSubjectType === 'academic') {
      setAcademicLessonTopic(p.lesson_covered || '');
    } else if (currentSubjectType === 'qaida') {
      if (p.lesson_number != null) setLessonNumber(String(p.lesson_number));
      if (p.page_number != null) setPageNumber(String(p.page_number));
      if (p.qaida_page_id) setQaidaPageId(p.qaida_page_id);
      if (p.qaida_baab_id) setQaidaBaabId(p.qaida_baab_id);
      if (p.qaida_word_from_id) setQaidaWordFromId(p.qaida_word_from_id);
      if (p.qaida_word_to_id) setQaidaWordToId(p.qaida_word_to_id);
      if (p.qaida_unit_from != null) setQaidaUnitFrom(String(p.qaida_unit_from));
      if (p.qaida_unit_to != null) setQaidaUnitTo(String(p.qaida_unit_to));
    } else {
      if (p.sabaq_marker_type) setMarkerType(p.sabaq_marker_type);
      setAyahFromSurah(p.sabaq_surah_from || '');
      setAyahToSurah(p.sabaq_surah_to || '');
      setAyahFromNumber(p.sabaq_ayah_from != null ? String(p.sabaq_ayah_from) : '');
      setAyahToNumber(p.sabaq_ayah_to != null ? String(p.sabaq_ayah_to) : '');
      setRukuFromJuz(p.sabaq_ruku_from_juz != null ? String(p.sabaq_ruku_from_juz) : '');
      setRukuFromNumber(p.sabaq_ruku_from_number != null ? String(p.sabaq_ruku_from_number) : '');
      setRukuToJuz(p.sabaq_ruku_to_juz != null ? String(p.sabaq_ruku_to_juz) : '');
      setRukuToNumber(p.sabaq_ruku_to_number != null ? String(p.sabaq_ruku_to_number) : '');
      setQuarterFromJuz(p.sabaq_quarter_from_juz != null ? String(p.sabaq_quarter_from_juz) : '');
      setQuarterFromNumber(p.sabaq_quarter_from_number != null ? String(p.sabaq_quarter_from_number) : '');
      setQuarterToJuz(p.sabaq_quarter_to_juz != null ? String(p.sabaq_quarter_to_juz) : '');
      setQuarterToNumber(p.sabaq_quarter_to_number != null ? String(p.sabaq_quarter_to_number) : '');
    }
  };

  // "New Lesson" for Qaida: continue right after wherever the last entry stopped,
  // leaving the "to" side empty for the teacher to fill in.
  const applyNextQaidaLesson = () => {
    const p: any = previousLesson;
    if (!p || currentSubjectType !== 'qaida') return;
    const baabs = qaidaRef?.baabs || [];
    const lastBaab = baabs.find(b => b.id === p.qaida_baab_id)
      || (p.lesson_number != null ? baabs.find(b => b.baab_number === Number(p.lesson_number)) : undefined);
    if (!lastBaab) return;

    const lastTo = Number(p.qaida_unit_to || 0);
    let nextBaab = lastBaab;
    let nextFrom = lastTo + 1;
    if (lastTo >= (lastBaab.total_units || 0)) {
      const following = baabs.find(b => b.baab_number === lastBaab.baab_number + 1);
      if (!following) return; // book finished — leave fields as-is
      nextBaab = following;
      nextFrom = 1;
    }

    setQaidaBaabId(nextBaab.id);
    setLessonNumber(String(nextBaab.baab_number));
    setPageNumber(String(nextBaab.start_page));
    setQaidaPageId(qaidaRef?.pages.find(pg => pg.page_number === nextBaab.start_page)?.id || '');
    setQaidaWordFromId('');
    setQaidaWordToId('');
    setQaidaUnitFrom(String(nextFrom));
    setQaidaUnitTo('');
  };

  const handleLessonTypeChange = (v: LessonType) => {
    setLessonType(v);
    if (v === 'repeat') applyPreviousLesson();
    if (v === 'new') applyNextQaidaLesson();
  };

  // Auto-detect: if entered Sabaq range matches previous, suggest switching to "repeat"
  const autoDetectedRepeat = useMemo(() => {
    if (!previousLesson || lessonType === 'repeat') return false;
    const p: any = previousLesson;
    if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') {
      return (
        !!ayahFromSurah && ayahFromSurah === (p.sabaq_surah_from || '') &&
        ayahFromNumber === (p.sabaq_ayah_from != null ? String(p.sabaq_ayah_from) : '') &&
        ayahToNumber === (p.sabaq_ayah_to != null ? String(p.sabaq_ayah_to) : '')
      );
    }
    if (currentSubjectType === 'academic') {
      return !!academicLessonTopic && academicLessonTopic.trim() === (p.lesson_covered || '').trim();
    }
    if (currentSubjectType === 'qaida') {
      return !!lessonNumber && lessonNumber === (p.lesson_number != null ? String(p.lesson_number) : '');
    }
    return false;
  }, [previousLesson, lessonType, currentSubjectType, ayahFromSurah, ayahFromNumber, ayahToNumber, academicLessonTopic, lessonNumber]);



  // Get scheduled days array
  const scheduleLoaded = scheduleData !== undefined;
  const scheduledDays = useMemo(() => {
    if (!scheduleData) return [];
    return Array.from(new Set(scheduleData.map(s => s.day_of_week.toLowerCase())));
  }, [scheduleData]);
  /** Student has no active weekly slot at all — every day is an off day for them. */
  const hasNoSchedule = scheduleLoaded && scheduledDays.length === 0;

  const { activeModelType } = useDivision();
  const isOneToOne = activeModelType === 'one_to_one';

  // Check if selected date is a scheduled day for this student.
  // Off days (weekends / non-slot days) are never silently allowed — the teacher
  // must tick the "extra / make-up class" confirmation to mark them. A student with
  // no active schedule rows counts as unscheduled too (previously this silently
  // allowed any date).
  const isScheduledDay = useMemo(() => {
    if (!classDate || !scheduleLoaded) return true;
    if (scheduledDays.length === 0) return false;
    const dayIndex = getDay(parseISO(classDate));
    const dayName = DAY_NAMES[dayIndex];
    return scheduledDays.includes(dayName);
  }, [classDate, scheduledDays, scheduleLoaded]);

  /**
   * The only dates a regular attendance record may use: the student's scheduled
   * class days in the last 60 days that are not academy holidays. Rescheduling is a
   * separate flow, so off days never appear here.
   */
  const eligibleDates = useMemo(() => {
    if (scheduledDays.length === 0) return [] as string[];
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i <= 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = format(d, 'yyyy-MM-dd');
      if (!scheduledDays.includes(DAY_NAMES[getDay(d)])) continue;
      if (recentHolidaySet.has(iso)) continue;
      out.push(iso);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledDays.join(','), recentHolidays]);

  /** Explicit date passed in (e.g. "Mark now" on a missed slot) wins over any default. */
  useEffect(() => {
    if (!open || isEdit || !initialDate) return;
    setClassDate(initialDate);
  }, [open, isEdit, initialDate]);

  /** Default the date to the latest scheduled, non-holiday day on/before today. */
  useEffect(() => {
    if (!open || isEdit || initialDate || scheduledDays.length === 0) return;
    const today = new Date();
    const isUsable = (d: Date) =>
      scheduledDays.includes(DAY_NAMES[getDay(d)]) && !recentHolidaySet.has(format(d, 'yyyy-MM-dd'));
    if (isUsable(today)) return; // today is fine
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (isUsable(d)) {
        setClassDate(format(d, 'yyyy-MM-dd'));
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, initialDate, scheduledDays.join(','), recentHolidays]);



  // Get scheduled time for the selected day. Falls back to the student's usual slot
  // (their other active schedule rows) so ad-hoc / make-up days still auto-fill and the
  // teacher never has to type the time manually.
  const getScheduledInfoForDay = (date: string) => {
    if (!scheduleData || scheduleData.length === 0 || !date) return null;
    const dayIndex = getDay(parseISO(date));
    const dayName = DAY_NAMES[dayIndex];
    const exact = scheduleData.find(s => s.day_of_week.toLowerCase() === dayName);
    // Fallback: most frequent time across the student's active slots
    const fallback = (() => {
      const counts = new Map<string, { row: typeof scheduleData[number]; n: number }>();
      for (const s of scheduleData) {
        const key = (s.teacher_local_time || '').substring(0, 5);
        if (!key) continue;
        const prev = counts.get(key);
        counts.set(key, { row: prev?.row ?? s, n: (prev?.n ?? 0) + 1 });
      }
      let best: { row: typeof scheduleData[number]; n: number } | null = null;
      for (const v of counts.values()) if (!best || v.n > best.n) best = v;
      return best?.row ?? null;
    })();
    const schedule = exact ?? fallback;
    return schedule ? {
      time: schedule.teacher_local_time,
      duration: schedule.duration_minutes,
      studentTime: schedule.student_local_time,
      isExactDay: !!exact,
    } : null;
  };

  // Auto-fill time + duration from the schedule whenever the date changes or the modal
  // opens (create mode only — edit preserves recorded values).
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

  const autoFilledSlot = useMemo(
    () => (isEdit || !classDate ? null : getScheduledInfoForDay(classDate)),
    [isEdit, classDate, scheduleData],
  );


  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'student_leave', 'teacher_absent', 'teacher_leave'].includes(status);

  const requiresReschedule = (status: AttendanceStatus) => 
    ['rescheduled', 'student_rescheduled'].includes(status);

  // Reset/hydrate form on open. Edit mode hydrates from activeRecord; create mode resets to defaults.
  useEffect(() => {
    if (!open) {
      setSelectedStatus(initialStatus || 'present');
      setClassTime('');
      setClassDate(format(new Date(), 'yyyy-MM-dd'));
      setDuration('30');
      setRemarks('');
      setVoiceNoteUrl(null);
      setReasonCategory('');
      setReasonText('');
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleBy('teacher');
      setRescheduleReason('');
      setLeaveEndDate('');
      setLessonNumber('');
      setPageNumber('');
      setQaidaPageId('');
      setQaidaBaabId('');
      setQaidaWordFromId('');
      setQaidaWordToId('');
      setQaidaUnitFrom('');
      setQaidaUnitTo('');
      setMarkerType('ayah');
      setRukuFromJuz(''); setRukuFromNumber(''); setRukuToJuz(''); setRukuToNumber('');
      setQuarterFromJuz(''); setQuarterFromNumber(''); setQuarterToJuz(''); setQuarterToNumber('');
      setJuzFrom(''); setJuzTo(''); setExtraSegments([]);

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
      setLessonType('');
      setRepeatReason('');
      setRepeatReasonNote('');
      setManzilAnswered(false);
      setPickedStudentId('');
      return;
    }

    // EDIT MODE: hydrate every state from activeRecord
    if (isEdit && activeRecord) {
      const r = activeRecord;
      setSelectedStatus(r.status);
      setClassDate(r.class_date);
      setClassTime(r.class_time ? r.class_time.substring(0, 5) : '');
      setDuration(String(r.duration_minutes ?? 30));
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
      setManzilAnswered(r.manzil_done !== null && r.manzil_done !== undefined);
      setLessonNumber(r.lesson_number != null ? String(r.lesson_number) : '');
      setPageNumber(r.page_number != null ? String(r.page_number) : '');
      setQaidaPageId((r as any).qaida_page_id || '');
      setQaidaBaabId((r as any).qaida_baab_id || '');
      setQaidaWordFromId((r as any).qaida_word_from_id || '');
      setQaidaWordToId((r as any).qaida_word_to_id || '');
      setQaidaUnitFrom((r as any).qaida_unit_from != null ? String((r as any).qaida_unit_from) : '');
      setQaidaUnitTo((r as any).qaida_unit_to != null ? String((r as any).qaida_unit_to) : '');
      setLinesCompleted(r.lines_completed != null ? String(r.lines_completed) : '');
      setVarianceReason(r.variance_reason ?? '');
      setInputUnit(r.input_unit ?? '');
      setRawInputAmount(r.raw_input_amount != null ? String(r.raw_input_amount) : '');
      setAcademicLessonTopic(r.lesson_covered ?? '');
      // Lesson type hydration (read directly off the row — may not be in the typed interface yet)
      const rAny = r as any;
      setLessonType((rAny.lesson_type === 'repeat' || rAny.lesson_type === 'new') ? rAny.lesson_type : '');
      setRepeatReason(rAny.repeat_reason || '');
      setRepeatReasonNote(rAny.repeat_reason_note || '');
      setJuzFrom(''); setJuzTo(''); setExtraSegments([]);
      return;
    }

    if (initialStatus) setSelectedStatus(initialStatus);
  }, [open, initialStatus, isEdit, activeRecord]);

  // Hydrate saved lesson segments in edit mode. Segment 0 mirrors the primary
  // inputs (already hydrated from the flat sabaq_* columns) except for whole-Juz
  // marking, which only lives in the segments table.
  useEffect(() => {
    if (!open || !isEdit || !activeRecord?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('attendance_lesson_segments')
        .select('*')
        .eq('attendance_id', activeRecord.id)
        .eq('section', 'sabaq')
        .order('segment_index');
      if (cancelled || error || !data) return;
      const segs = data.map(segmentFromDbRow);
      const primary = segs[0];
      if (primary?.markerType === 'juz') {
        setMarkerType('juz');
        setJuzFrom(primary.juzFrom != null ? String(primary.juzFrom) : '');
        setJuzTo(primary.juzTo != null ? String(primary.juzTo) : '');
      }
      setExtraSegments(segs.slice(1));
    })();
    return () => { cancelled = true; };
  }, [open, isEdit, activeRecord?.id]);


  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!resolvedTeacherId) throw new Error('Missing teacher');

      // For teacher-only / holiday statuses with no preset student, fall back to first
      // student in the picker list so the row still records (legacy behaviour).
      let resolvedStudentId = student.id;
      if (!resolvedStudentId && isTeacherOnlyStatus && students && students.length > 0) {
        resolvedStudentId = students[0].id;
      }
      if (!resolvedStudentId) throw new Error('Please select a student');

      // Normalized lesson segments (Hifz/Nazra) — segment 0 mirrors the primary inputs
      const primarySegment: LessonSegment =
        markerType === 'ruku'
          ? { markerType: 'ruku', juzFrom: rukuFromJuz, unitFrom: rukuFromNumber, juzTo: rukuToJuz, unitTo: rukuToNumber }
          : markerType === 'quarter'
          ? { markerType: 'quarter', juzFrom: quarterFromJuz, unitFrom: quarterFromNumber, juzTo: quarterToJuz, unitTo: quarterToNumber }
          : markerType === 'juz'
          ? { markerType: 'juz', juzFrom, juzTo }
          : { markerType: 'ayah', surahFrom: ayahFromSurah, ayahFrom: ayahFromNumber, surahTo: ayahToSurah, ayahTo: ayahToNumber };
      const allSegments = [primarySegment, ...extraSegments].filter(isSegmentComplete);
      const normalizedLesson = formatLessonSegments(allSegments);

      // Build lesson_covered based on subject type
      let lessonCoveredText = '';
      if (currentSubjectType === 'qaida') {
        lessonCoveredText = lessonNumber
          ? `Baab ${lessonNumber}${pageNumber ? `, Page ${pageNumber}` : ''}${qaidaUnitTo ? `, up to unit ${qaidaUnitTo}` : ''}`
          : '';
      } else if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') {
        lessonCoveredText = normalizedLesson;

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
        const rrLabel = rescheduleReason === 'other' ? reasonText : (RESCHEDULE_REASONS.find(r => r.value === rescheduleReason)?.label || '');
        const byLabel = rescheduleBy === 'student' ? 'Student' : 'Teacher';
        finalReason = `Rescheduled by ${byLabel}${rrLabel ? ` — ${rrLabel}` : ''}. Make-up for missed class on ${rescheduleDate}${rescheduleTime ? ` at ${rescheduleTime}` : ''}. ${remarks || ''}`.trim();
      }

      // Build the full payload. In edit mode we always write the Phase A superset
      // so progress fields edited in the dialog actually persist.
      const isHifzOrNazra = currentSubjectType === 'hifz' || currentSubjectType === 'nazra';
      const isQaida = currentSubjectType === 'qaida';

      const isLeave = selectedStatus === 'student_leave' || selectedStatus === 'teacher_leave';
      const effectiveClassTime = classTime || (isLeave ? '00:00' : classTime);

      const basePayload: Record<string, any> = {
        class_date: classDate,
        class_time: effectiveClassTime,
        duration_minutes: parseInt(duration) || 30,
        status: selectedStatus,
        reason: finalReason || null,
        lesson_covered: lessonCoveredText || null,
        lesson_display: isHifzOrNazra ? (normalizedLesson || null) : (lessonCoveredText || null),
        lesson_segment_count: isHifzOrNazra ? allSegments.length : null,

        reason_category: reasonCategory || null,
        reason_text: reasonCategory === 'other' ? reasonText : null,
        reschedule_date: rescheduleDate || null,
        reschedule_time: rescheduleTime || null,
        surah_name: isQaida ? null : (ayahFromSurah || null),
        ayah_from: isQaida ? null : (ayahFromNumber ? parseInt(ayahFromNumber) : null),
        ayah_to: isQaida ? null : (ayahToNumber ? parseInt(ayahToNumber) : null),
        lesson_number: isQaida && lessonNumber ? parseInt(lessonNumber) : null,
        page_number: isQaida && pageNumber ? parseInt(pageNumber) : null,
        qaida_page_id: isQaida ? (qaidaPageId || null) : null,
        qaida_baab_id: isQaida ? (qaidaBaabId || null) : null,
        qaida_word_from_id: isQaida ? (qaidaWordFromId || null) : null,
        qaida_word_to_id: isQaida ? (qaidaWordToId || null) : null,
        qaida_unit_from: isQaida && qaidaUnitFrom ? parseInt(qaidaUnitFrom) : null,
        qaida_unit_to: isQaida && qaidaUnitTo ? parseInt(qaidaUnitTo) : null,
        sabaq_surah_from: isHifzOrNazra ? ayahFromSurah || null : null,
        sabaq_surah_to: isHifzOrNazra ? ayahToSurah || null : null,
        sabaq_ayah_from: isHifzOrNazra && ayahFromNumber ? parseInt(ayahFromNumber) : null,
        sabaq_ayah_to: isHifzOrNazra && ayahToNumber ? parseInt(ayahToNumber) : null,
        sabqi_done: currentSubjectType === 'hifz' ? sabqiDone : null,
        manzil_done: currentSubjectType === 'hifz' ? manzilDone : null,
        voice_note_url: voiceNoteUrl || null,
        lesson_type: lessonRequired ? (lessonType || null) : null,
        // Free-text replaces the dropdown — keep `repeat_reason` set to 'other'
        // for back-compat with existing analytics queries; canonical content lives in `repeat_reason_note`.
        repeat_reason: lessonRequired && lessonType === 'repeat' ? 'other' : null,
        repeat_reason_note: lessonRequired && lessonType === 'repeat' ? (repeatReasonNote.trim() || null) : null,
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
      let leaveSummary: { inserted: number; skipped: number; total: number } | null = null;

      if (isEdit && activeRecord) {
        const { error } = await supabase
          .from('attendance')
          .update({ ...basePayload, ...phaseAPayload })
          .eq('id', activeRecord.id);
        if (error) throw error;
        savedId = activeRecord.id;
      } else if (isLeave && leaveEndDate && leaveEndDate > classDate) {
        // Multi-day leave — expand into one row per date (cap 31 days)
        const start = parseISO(classDate);
        const end = parseISO(leaveEndDate);
        const dates: string[] = [];
        const cursor = new Date(start);
        while (cursor <= end && dates.length < 31) {
          dates.push(format(cursor, 'yyyy-MM-dd'));
          cursor.setDate(cursor.getDate() + 1);
        }

        // Dedupe against existing attendance for this student in the range
        const { data: existingRows } = await supabase
          .from('attendance')
          .select('class_date')
          .eq('student_id', resolvedStudentId)
          .gte('class_date', dates[0])
          .lte('class_date', dates[dates.length - 1]);
        const taken = new Set((existingRows || []).map((r: any) => r.class_date));
        const newDates = dates.filter(d => !taken.has(d));

        if (newDates.length > 0) {
          const rows = newDates.map(d => {
            const info = getScheduledInfoForDay(d);
            return {
              student_id: resolvedStudentId,
              teacher_id: resolvedTeacherId,
              ...basePayload,
              ...phaseAPayload,
              class_date: d,
              class_time: info?.time?.substring(0, 5) || '00:00',
              duration_minutes: info?.duration || parseInt(duration) || 30,
            };
          });
          const { data, error } = await supabase.from('attendance').insert(rows as any).select('id');
          if (error) throw error;
          savedId = data?.[0]?.id;
        }
        leaveSummary = { inserted: newDates.length, skipped: dates.length - newDates.length, total: dates.length };
      } else {
        const insertPayload: any = {
          student_id: resolvedStudentId,
          teacher_id: resolvedTeacherId,
          ...basePayload,
          ...phaseAPayload,
        };
        const { data, error } = await supabase.from('attendance').insert(insertPayload).select('id').single();
        if (error) throw error;
        savedId = data?.id;
      }

      // Persist normalized lesson segments (rewrite-in-place: delete then insert).
      if (savedId && isHifzOrNazra) {
        await supabase.from('attendance_lesson_segments').delete().eq('attendance_id', savedId).eq('section', 'sabaq');
        if (allSegments.length > 0) {
          const segRows = allSegments.map((seg, i) => segmentToDbRow(seg, savedId!, i, 'sabaq'));
          const { error: segErr } = await supabase.from('attendance_lesson_segments').insert(segRows);
          if (segErr) console.warn('[lesson-segments] insert failed', segErr);
        }
      }



      // Log reschedule history (best-effort; never blocks the save). Create-mode only —
      // edits don't fork a new reschedule record.
      if (!isEdit && requiresReschedule(selectedStatus) && rescheduleDate && user?.id) {
        try {
          await supabase.from('session_reschedules' as any).insert({
            attendance_id: savedId,
            student_id: resolvedStudentId,
            teacher_id: resolvedTeacherId,
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

      return { id: savedId, leaveSummary };
    },
    onSuccess: (result) => {
      if (result?.leaveSummary) {
        const { inserted, skipped, total } = result.leaveSummary;
        toast({
          title: 'Leave Recorded',
          description: `${inserted} of ${total} day(s) marked${skipped ? ` — ${skipped} already had attendance` : ''}.`,
        });
      } else {
        toast({
          title: isEdit ? 'Attendance Updated' : 'Attendance Marked',
          description: isEdit
            ? `Updated record for ${student.full_name}`
            : `Attendance recorded for ${student.full_name}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students-detailed'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const raw = error?.message || String(error);
      const code = error?.code || '';
      let friendly = raw;
      if (code === '42501' || /row-level security|permission denied/i.test(raw)) {
        friendly = 'You do not have permission to mark attendance for this student. Please contact an admin.';
      } else if (/duplicate|already/i.test(raw)) {
        friendly = 'A record already exists for this student at this date and time. Edit the existing record instead.';
      }
      toast({
        title: 'Attendance could not be saved',
        description: friendly,
        variant: 'destructive',
      });
      // Leave a trace so "it won't save" reports can be investigated.
      trackActivity({
        action: 'attendance_save_failed',
        entityType: 'attendance',
        entityId: activeRecord?.id,
        entityLabel: student.full_name,
        details: {
          student_id: student.id,
          class_date: classDate,
          class_time: classTime,
          status: selectedStatus,
          error_code: code,
          error_message: raw,
        },
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
    if (currentSubjectType === 'qaida') return !!qaidaBaabId && !!qaidaUnitTo;
    if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') return !!(ayahFromSurah && ayahFromNumber);
    if (currentSubjectType === 'academic') return !!academicLessonTopic?.trim();
    return true;
  }, [lessonRequired, currentSubjectType, lessonNumber, qaidaBaabId, qaidaUnitTo, ayahFromSurah, ayahFromNumber, academicLessonTopic]);

  const isTeacherOnlyStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
  const needsStudent = !isTeacherOnlyStatus;
  const isLeaveStatus = selectedStatus === 'student_leave' || selectedStatus === 'teacher_leave';
  const canAssignFutureDate = isLeaveStatus;

  // Every reason the save is blocked, in plain language. The button stays disabled,
  // but the teacher always sees exactly what is missing instead of a dead grey button.
  const blockingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!classDate) reasons.push('Pick the class date.');
    // Leave statuses don't require a slot time — they cover whole days
    if (!isLeaveStatus && !classTime) reasons.push('Set the class time for this slot.');
    if (isFutureDate && !canAssignFutureDate) reasons.push('This date is in the future — only leave can be recorded ahead of time.');
    if (needsStudent && !student.id) reasons.push('No student selected for this record.');
    // Leave can be marked even when the day isn't scheduled or already has a record
    if (!isLeaveStatus && hasDuplicateAttendance) {
      reasons.push(`Attendance already exists for ${student.full_name} on ${classDate ? format(parseISO(classDate), 'dd MMM yyyy') : 'this date'}${classTime ? ` at ${classTime.slice(0, 5)}` : ''} — edit that record instead, or change the time.`);
    }
    // Only scheduled class days can carry a regular attendance record. Off days and
    // holidays are handled through the Rescheduled status instead. Leave, holiday and
    // reschedule rows are exempt.
    const offDayExempt = isLeaveStatus || selectedStatus === 'holiday' || requiresReschedule(selectedStatus) || isEdit;
    if (!offDayExempt && isHolidayDate) {
      reasons.push(`${format(parseISO(classDate), 'dd MMM yyyy')} is an academy holiday${holidayRow?.name ? ` (${holidayRow.name})` : ''} — use the "Rescheduled" status if a make-up class ran.`);
    }
    if (!offDayExempt && !isScheduledDay) {
      reasons.push(`This is not a scheduled class day for ${student.full_name || 'this student'} — pick a scheduled day, or use the "Rescheduled" status for a make-up class.`);
    }

    if (requiresReason(selectedStatus) && !reasonCategory) reasons.push('Choose a reason for this absence or leave.');
    if (requiresReason(selectedStatus) && reasonCategory === 'other' && !reasonText.trim()) reasons.push('Describe the reason (you selected "Other").');
    if (requiresReschedule(selectedStatus) && !rescheduleDate) reasons.push('Set the rescheduled date.');
    if (requiresReschedule(selectedStatus) && !rescheduleReason) reasons.push('Choose why the class was rescheduled.');
    if (requiresReschedule(selectedStatus) && rescheduleReason === 'other' && !reasonText.trim()) reasons.push('Describe the reschedule reason (you selected "Other").');
    if (lessonRequired && !hasLessonDetails) {
      if (currentSubjectType === 'qaida') reasons.push('Select the Baab and the unit covered today.');
      else if (currentSubjectType === 'hifz' || currentSubjectType === 'nazra') reasons.push('Select the Surah and Ayah covered today.');
      else reasons.push('Enter the lesson topic covered today.');
    }
    // Lesson Today (new vs repeat) is required whenever a lesson was conducted.
    if (lessonRequired && !lessonType) reasons.push('Choose "Lesson Today" — New lesson or Same as last class.');
    // When repeating, a written explanation (reason + what was done) is required.
    if (lessonRequired && lessonType === 'repeat' && repeatReasonNote.trim().length < 10) reasons.push('Explain why the lesson was repeated (at least 10 characters).');
    return reasons;
  }, [selectedStatus, isLeaveStatus, canAssignFutureDate, classTime, classDate, reasonCategory, reasonText, rescheduleDate, rescheduleReason, hasDuplicateAttendance, isScheduledDay, isHolidayDate, holidayRow, isEdit, isFutureDate, lessonRequired, hasLessonDetails, needsStudent, student.id, student.full_name, lessonType, repeatReason, repeatReasonNote, currentSubjectType, manzilAnswered]);

  const isFormValid = blockingReasons.length === 0;

  const studentTzAbbr = getTimezoneAbbr(student.timezone);
  const teacherTzAbbr = getTimezoneAbbr(effectiveTeacherTz);

  /** Switching status must never leave stale reschedule data behind (unchanged rule). */
  const changeStatus = (next: AttendanceStatus) => {
    if (!requiresReschedule(next)) {
      setRescheduleDate('');
      setRescheduleTime('');
    }
    setSelectedStatus(next);
  };

  const isAdminUser = profile?.roles?.some((r) => r === 'admin' || r === 'super_admin') ?? false;
  /** The four everyday statuses. Everything else stays reachable under "More". */
  const PRIMARY_STATUSES = [
    { value: 'present' as AttendanceStatus, label: 'Present', icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeClass: 'bg-emerald-600 text-white' },
    { value: 'student_absent' as AttendanceStatus, label: 'Absent', icon: <XCircle className="h-3.5 w-3.5" />, activeClass: 'bg-rose-600 text-white' },
    { value: 'student_leave' as AttendanceStatus, label: 'Leave', icon: <PauseCircle className="h-3.5 w-3.5" />, activeClass: 'bg-amber-500 text-white' },
    { value: 'rescheduled' as AttendanceStatus, label: 'Rescheduled', icon: <CalendarClock className="h-3.5 w-3.5" />, activeClass: 'bg-slate-600 text-white' },
  ];
  const primaryValues = PRIMARY_STATUSES.map(s => s.value);
  const secondaryStatuses = STATUS_OPTIONS.filter((opt) => {
    if (primaryValues.includes(opt.value)) return false;
    if (opt.value === 'holiday') return isAdminUser;
    return true;
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[calc(100vw-1rem)] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden bg-card border-border text-foreground">
        {/* Sticky header */}
        <DialogHeader className="shrink-0 border-b border-border px-4 sm:px-6 py-3 space-y-1 text-left">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
              <User className="h-4.5 w-4.5 text-teal-600" />
            </div>
            <span className="truncate">{student.full_name || (isEdit ? 'Edit Attendance' : 'Mark Attendance')}</span>
            {resolvedSubjectName && (
              <Badge className="ml-auto shrink-0 bg-teal-600/10 text-teal-700 dark:text-teal-300 border-teal-600/30">
                <BookOpen className="h-3 w-3 mr-1" />
                {resolvedSubjectName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {classDate ? format(parseISO(classDate), 'EEE, dd MMM yyyy') : '—'}
            {classTime ? ` · ${classTime}` : ''}
            {!isLeaveStatus && duration ? ` · ${duration} min` : ''}
            {student.last_lesson ? ` · Last: ${student.last_lesson}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4">

        {/* Student Picker (when no preset) */}
        {!presetStudent && students && students.length > 0 && needsStudent && (
          <div className="bg-muted rounded-2xl p-3 space-y-2">
            <Label className="text-foreground text-xs">Student <span className="text-destructive">*</span></Label>
            <Select value={pickedStudentId} onValueChange={setPickedStudentId}>
              <SelectTrigger className="">
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


        <div className="space-y-4 py-2">
          {/* Duplicate Attendance Warning — offers an in-place switch to edit mode */}
          {hasDuplicateAttendance && (
            <Alert className="bg-destructive/10 border-destructive/30 text-destructive">
              <Ban className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>
                  Attendance already marked for {format(parseISO(classDate), 'dd MMM yyyy')}
                  {classTime ? ` at ${classTime.slice(0, 5)}` : ''} ({existingAttendance?.[0]?.status?.replace(/_/g, ' ')}).
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setSwitchEditId(existingAttendance?.[0]?.id ?? null)}
                >
                  Edit existing record
                </Button>
              </AlertDescription>
            </Alert>
          )}


          {/* Off day / holiday guard — hidden for leave, holiday and reschedule rows */}
          {(isHolidayDate || !isScheduledDay) && !isEdit && !hasDuplicateAttendance && !isFutureDate
            && !isLeaveStatus && selectedStatus !== 'holiday' && !requiresReschedule(selectedStatus) && (
            <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>
                  {isHolidayDate
                    ? <>This date is an academy holiday{holidayRow?.name ? ` — ${holidayRow.name}` : ''}. Classes are off.</>
                    : hasNoSchedule
                      ? <>This student has no active weekly schedule, so no day counts as a class day. Set up their schedule first.</>
                      : <>This is not a scheduled day. Scheduled: {scheduledDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'None'}.</>}
                </p>
                <p className="text-xs">
                  Attendance can only be marked on class days. If a make-up class ran,
                  set the status to <span className="font-medium">Rescheduled</span> instead.
                </p>
              </AlertDescription>
            </Alert>
          )}


          {/* Future Date Warning */}
          {isFutureDate && !canAssignFutureDate && (
            <Alert className="bg-destructive/10 border-destructive/30 text-destructive">
              <Ban className="h-4 w-4" />
              <AlertDescription>
                Cannot mark attendance for future dates.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Status card ─────────────────────────────────────────── */}
          <section className="rounded-2xl border border-border bg-muted/40 p-3 sm:p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Status <span className="text-destructive">*</span></Label>
              <SegmentedControl
                aria-label="Attendance status"
                value={PRIMARY_STATUSES.some(s => s.value === selectedStatus) ? selectedStatus : ('' as any)}
                onChange={(v) => changeStatus(v as AttendanceStatus)}
                options={PRIMARY_STATUSES}
                gridClassName="grid-cols-2 sm:grid-cols-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">More statuses</Label>
              <Select
                value={secondaryStatuses.some(o => o.value === selectedStatus) ? selectedStatus : ''}
                onValueChange={(v) => changeStatus(v as AttendanceStatus)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Teacher absent / leave, rescheduled by student…" />
                </SelectTrigger>
                <SelectContent>
                  {secondaryStatuses.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ── Class details card ──────────────────────────────────── */}
          <section className="rounded-2xl border border-border bg-muted/40 p-3 sm:p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class details</p>



          {/* Adaptive Date Block ---------------------------------------- */}
          {!requiresReschedule(selectedStatus) ? (
            // Variant A — non-reschedule statuses: single Date + Scheduled Time row
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Class Date <span className="text-destructive">*</span></Label>
                {!isEdit && !isLeaveStatus && selectedStatus !== 'holiday' && eligibleDates.length > 0 ? (
                  <>
                    <Select value={classDate} onValueChange={setClassDate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a class day" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {(eligibleDates.includes(classDate) ? eligibleDates : [classDate, ...eligibleDates]).map((d) => (
                          <SelectItem key={d} value={d}>
                            {format(parseISO(d), 'EEE, dd MMM yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Only this student's scheduled class days are listed.
                    </p>
                  </>
                ) : (
                  <Input
                    type="date"
                    value={classDate}
                    onChange={(e) => setClassDate(e.target.value)}
                    max={isLeaveStatus ? undefined : format(new Date(), 'yyyy-MM-dd')}
                    className="[ [&::-webkit-calendar-picker-indicator]:opacity-0::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Scheduled Time ({teacherTzAbbr}){!isLeaveStatus && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  type="time"
                  value={classTime}
                  onChange={(e) => setClassTime(e.target.value)}
                  placeholder={isLeaveStatus ? 'Optional for leave' : 'HH:MM'}
                  className="[&::-webkit-calendar-picker-indicator]:opacity-0"
                />
                {autoFilledSlot && (
                  <p className="text-[11px] text-muted-foreground">
                    {autoFilledSlot.isExactDay
                      ? 'Auto-filled from the weekly schedule. Edit only if the class ran at a different time.'
                      : 'No slot on this day — filled with the usual class time. Adjust if needed.'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Variant B — reschedule statuses: contained block, "Originally scheduled" first, "Actually conducted on" second
            <div className="rounded-lg bg-muted p-3 sm:p-4 space-y-4">
              {/* Info banner (blue, not amber — reschedule is routine) */}
              <div className="flex items-start gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-foreground">
                  <span className="font-medium">Reschedule details</span>
                  <span className="block text-xs text-muted-foreground">This class is a make-up for a missed slot.</span>
                </div>
              </div>

              {/* Sub-section 1: Originally scheduled (FIRST) */}
              <div className="space-y-2">
                <Label className="text-foreground text-sm font-semibold">Originally scheduled</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Date <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      min={format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="[ [&::-webkit-calendar-picker-indicator]:opacity-0::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Time</Label>
                    <Input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="[ [&::-webkit-calendar-picker-indicator]:opacity-0::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Pick the missed scheduled day this class makes up for.</p>
              </div>

              {/* Thin divider — no text label */}
              <div className="h-px bg-sky-200/15" />

              {/* Sub-section 2: Actually conducted on (SECOND) */}
              <div className="space-y-2">
                <Label className="text-foreground text-sm font-semibold">Actually conducted on</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Date <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={classDate}
                      onChange={(e) => setClassDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="[ [&::-webkit-calendar-picker-indicator]:opacity-0::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Time ({teacherTzAbbr}) <span className="text-destructive">*</span></Label>
                    <Input
                      type="time"
                      value={classTime}
                      onChange={(e) => setClassTime(e.target.value)}
                      className="[ [&::-webkit-calendar-picker-indicator]:opacity-0::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Can be any day, including weekends.</p>
              </div>
            </div>
          )}

          {/* Duration — fixed position. Hidden for leave (irrelevant for a day-off). */}
          {!isLeaveStatus && (
            <div className="space-y-2">
              <Label className="text-foreground">Duration (minutes)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                readOnly={!requiresReschedule(selectedStatus) && !isEdit}
                disabled={!requiresReschedule(selectedStatus) && !isEdit}
                className={cn(
                  duration !== '' ? 'text-foreground font-medium opacity-100' : 'text-muted-foreground',
                  !(requiresReschedule(selectedStatus) || isEdit) && 'bg-muted cursor-not-allowed disabled:opacity-100',
                )}
              />
            </div>
          )}
          </section>


          {/* Reason fields for absent status */}
          {requiresReason(selectedStatus) && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              {/* Leave date range — for student_leave / teacher_leave */}
              {(selectedStatus === 'student_leave' || selectedStatus === 'teacher_leave') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Leave From</Label>
                    <Input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Leave To</Label>
                    <Input type="date" value={leaveEndDate || classDate} min={classDate} onChange={(e) => setLeaveEndDate(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-foreground">
                  {selectedStatus === 'student_absent' && 'Why was the student absent?'}
                  {selectedStatus === 'student_leave' && 'Reason for student leave'}
                  {selectedStatus === 'teacher_absent' && 'Why was the teacher absent?'}
                  {selectedStatus === 'teacher_leave' && 'Reason for teacher leave'}
                  {' '}<span className="text-destructive">*</span>
                </Label>
                <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCategory)}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {visibleReasonCategories.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reasonCategory === 'other' && (
                <div className="space-y-2">
                  <Label className="text-foreground">Specify Reason <span className="text-destructive">*</span></Label>
                  <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Please specify..." />
                </div>
              )}
            </div>
          )}

          {/* Reschedule meta — by whom + reason */}
          {requiresReschedule(selectedStatus) && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Rescheduled By <span className="text-destructive">*</span></Label>
                  <Select value={rescheduleBy} onValueChange={(v) => { setRescheduleBy(v as any); setSelectedStatus(v === 'student' ? 'student_rescheduled' : 'rescheduled'); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Reschedule Reason <span className="text-destructive">*</span></Label>
                  <Select value={rescheduleReason} onValueChange={setRescheduleReason}>
                    <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      {RESCHEDULE_REASONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {rescheduleReason === 'other' && (
                <div className="space-y-2">
                  <Label className="text-foreground">Specify Reason <span className="text-destructive">*</span></Label>
                  <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Please specify..." />
                </div>
              )}
            </div>
          )}

          {/* ── Lesson card ─────────────────────────────────────────── */}
          {lessonRequired && (!needsStudent || !!student.id) && (
            <section className="rounded-2xl border border-border bg-muted/40 p-3 sm:p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lesson</p>

              {/* Lesson Today: New vs Same as last class + reason */}
              <LessonTypeSection
                lessonType={lessonType}
                onLessonTypeChange={handleLessonTypeChange}
                repeatReason={repeatReason}
                onRepeatReasonChange={setRepeatReason}
                repeatReasonNote={repeatReasonNote}
                onRepeatReasonNoteChange={setRepeatReasonNote}
                previousLesson={(previousLesson as any)?.lesson_covered || student.last_lesson}
                studentGender={studentGender}
                autoDetectedRepeat={autoDetectedRepeat}
                onAcceptAutoDetect={() => handleLessonTypeChange('repeat')}
              />

              {currentSubjectType === 'qaida' && (
                <QaidaProgressInput
                  lessonNumber={lessonNumber}
                  onLessonNumberChange={setLessonNumber}
                  pageNumber={pageNumber}
                  onPageNumberChange={setPageNumber}
                  qaidaPageId={qaidaPageId}
                  onQaidaPageIdChange={setQaidaPageId}
                  qaidaBaabId={qaidaBaabId}
                  onQaidaBaabIdChange={setQaidaBaabId}
                  wordFromId={qaidaWordFromId}
                  onWordFromIdChange={setQaidaWordFromId}
                  wordToId={qaidaWordToId}
                  onWordToIdChange={setQaidaWordToId}
                  unitFrom={qaidaUnitFrom}
                  onUnitFromChange={setQaidaUnitFrom}
                  unitTo={qaidaUnitTo}
                  onUnitToChange={setQaidaUnitTo}
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
                  juzFrom={juzFrom}
                  onJuzFromChange={setJuzFrom}
                  juzTo={juzTo}
                  onJuzToChange={setJuzTo}
                  extraSegments={extraSegments}
                  onExtraSegmentsChange={setExtraSegments}
                  resumeAyah={resumeAyah}
                  resumeKey={student.id}

                  sabqiDone={sabqiDone}
                  onSabqiDoneChange={setSabqiDone}
                  manzilDone={manzilDone}
                  onManzilDoneChange={(v) => { setManzilDone(v); setManzilAnswered(true); }}
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
                  extraSegments={extraSegments}
                  onExtraSegmentsChange={setExtraSegments}
                  resumeAyah={resumeAyah}
                  resumeKey={student.id}

                />
              )}

              {currentSubjectType === 'academic' && (
                <AcademicAttendanceFields
                  lessonTopic={academicLessonTopic}
                  onLessonTopicChange={setAcademicLessonTopic}
                  lessonStatus={academicLessonStatus}
                  onLessonStatusChange={(v) => setAcademicLessonStatus(v)}
                  followupSuggestions={academicFollowups}
                  onFollowupSuggestionsChange={setAcademicFollowups}
                />
              )}

              {/* Inline lesson-details validation error — appears directly under the offending fields */}
              {lessonRequired && !hasLessonDetails && (
                <p className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Lesson details are required when the class was conducted.</span>
                </p>
              )}

              {/* Manzil must be explicitly answered for Hifz/Nazra */}
              {lessonRequired && currentSubjectType === 'hifz' && !manzilAnswered && (
                <p className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Please answer Manzil / Revision (Yes or No) before saving.</span>
                </p>
              )}

            </section>

          )}

          {/* Voice note & remarks — collapsed by default */}
          <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card shadow-sm px-3">
            <AccordionItem value="notes" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                Voice note &amp; remarks (optional)
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <VoiceNoteRecorder
                  onUploadComplete={setVoiceNoteUrl}
                  uploadPath={`${student.id}/${classDate}`}
                />
                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">Remarks</Label>
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-border bg-card px-4 sm:px-6 py-3 space-y-2">
          {!isFormValid && blockingReasons.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{blockingReasons[0]}</span>
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => markAttendance.mutate()}
              disabled={!isFormValid || markAttendance.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
            >
              {markAttendance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : `Mark ${STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label || 'Attendance'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

