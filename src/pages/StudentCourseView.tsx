import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isPast, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, BookOpen, Calendar, FileText, ClipboardList,
  GraduationCap, MessageSquare, Video, Clock, ExternalLink,
  Loader2, Award, ChevronLeft, ChevronRight, RotateCcw,
  Upload, Download, Bell, BarChart3, Radio, Layers, FlipVertical,
  HelpCircle, Check, X, Users, Receipt, PlayCircle,
} from 'lucide-react';
import { DMChatSheet } from '@/components/chat/DMChatSheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { findOrCreateCourseDM, getCourseTeachers } from '@/lib/messaging';
import { ClassChatTab } from '@/components/courses/ClassChatTab';
import { ZoomClassPanel } from '@/components/classroom/ZoomClassPanel';
import { ClassmatesDirectory } from '@/components/courses/ClassmatesDirectory';

// ─── Helpers ───
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNowInTimezone(tz: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const weekday = get('weekday');
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayIndex: dayMap[weekday] ?? 0,
    hours: parseInt(get('hour'), 10),
    minutes: parseInt(get('minute'), 10),
    seconds: parseInt(get('second'), 10),
    absoluteMs: now.getTime(),
    dayName: DAY_NAMES[dayMap[weekday] ?? 0],
  };
}

function buildNextOccurrence(dayName: string, timeStr: string, durationMinutes: number, tz: string): Date {
  const tzNow = getNowInTimezone(tz);
  const targetDayIndex = DAY_NAMES.indexOf(dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase());
  if (targetDayIndex === -1) return new Date(tzNow.absoluteMs + 7 * 86400000);
  const [targetH, targetM] = (timeStr || '00:00').split(':').map(Number);
  let daysUntil = targetDayIndex - tzNow.dayIndex;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    const nowMins = tzNow.hours * 60 + tzNow.minutes;
    const classEndMins = targetH * 60 + targetM + durationMinutes;
    if (nowMins >= classEndMins) daysUntil = 7;
  }
  const nowSecsOfDay = tzNow.hours * 3600 + tzNow.minutes * 60 + tzNow.seconds;
  const targetSecsOfDay = targetH * 3600 + targetM * 60;
  const totalSecsDiff = daysUntil * 86400 + (targetSecsOfDay - nowSecsOfDay);
  return new Date(tzNow.absoluteMs + totalSecsDiff * 1000);
}

function formatTime12(time: string) {
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function useCountdown(target: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, total: 0 });
  useEffect(() => {
    if (!target) return;
    const calc = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
        total: diff,
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [target]);
  return timeLeft;
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function StudentCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const initialTab = searchParams.get('tab') || 'today';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [messagingTeacher, setMessagingTeacher] = useState(false);
  const [dmSheetOpen, setDmSheetOpen] = useState(false);
  const [dmGroupId, setDmGroupId] = useState<string | null>(null);
  const [dmRecipientName, setDmRecipientName] = useState('');
  const [showZoomIframe, setShowZoomIframe] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Dialogs
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [lessonSheetOpen, setLessonSheetOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitAssignment, setSubmitAssignment] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatSubTab, setChatSubTab] = useState<'chat' | 'classmates'>('chat');

  // Flashcard state
  const [currentFlashcardIdx, setCurrentFlashcardIdx] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Slides state
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);

  // Quiz state
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ─── Course teachers ───
  const { data: courseTeachers = [] } = useQuery({
    queryKey: ['course-teachers', courseId, user?.id],
    queryFn: () => getCourseTeachers(user!.id, courseId!),
    enabled: !!courseId && !!user?.id,
  });

  const handleMessageTeacher = async (teacher: { userId: string; name: string }) => {
    if (!user?.id || !courseId) return;
    setMessagingTeacher(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const dmId = await findOrCreateCourseDM(user.id, teacher.userId, courseId, course?.name || '', profile?.full_name || '', teacher.name);
      if (dmId) {
        setDmGroupId(dmId);
        setDmRecipientName(teacher.name);
        setDmSheetOpen(true);
      } else toast.error('Failed to create conversation');
    } catch { toast.error('Failed to start conversation'); }
    finally { setMessagingTeacher(false); }
  };

  // ─── Course details ───
  const { data: course, isLoading } = useQuery({
    queryKey: ['student-course', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, description, division_id, student_dm_mode, divisions:divisions(name)')
        .eq('id', courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  // ─── My enrollment ───
  const { data: enrollment } = useQuery({
    queryKey: ['student-enrollment', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_enrollments')
        .select('id, status, enrolled_at')
        .eq('course_id', courseId!).eq('student_id', user!.id).single();
      return data;
    },
    enabled: !!courseId && !!user?.id,
  });

  // ─── My class ───
  const { data: myClass } = useQuery({
    queryKey: ['student-class', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_students')
        .select('id, class:course_classes!inner(id, name, schedule_days, schedule_time, session_duration, meeting_link, timezone, course_id)')
        .eq('student_id', user!.id).eq('class.course_id', courseId!);
      return (data?.[0] as any)?.class || null;
    },
    enabled: !!courseId && !!user?.id,
  });

  // ─── Class staff (teacher name) ───
  const { data: classTeacher } = useQuery({
    queryKey: ['class-teacher', myClass?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_staff')
        .select('user_id, profile:profiles!course_class_staff_user_id_fkey(full_name)')
        .eq('class_id', myClass!.id).eq('staff_role', 'teacher').limit(1);
      return (data?.[0] as any)?.profile?.full_name || 'Teacher';
    },
    enabled: !!myClass?.id,
  });

  // ─── Student timezone ───
  const { data: studentTz } = useQuery({
    queryKey: ['student-tz', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('timezone').eq('id', user!.id).single();
      return data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    },
    enabled: !!user?.id,
  });
  const tz = studentTz || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ─── Next class calculation ───
  const nextClassDate = useMemo(() => {
    if (!myClass) return null;
    const days: string[] = myClass.schedule_days || [];
    let earliest: Date | null = null;
    days.forEach(day => {
      const dt = buildNextOccurrence(day, myClass.schedule_time || '00:00', myClass.session_duration || 30, myClass.timezone || tz);
      if (!earliest || dt < earliest) earliest = dt;
    });
    return earliest;
  }, [myClass, tz]);

  const countdown = useCountdown(nextClassDate);
  const minutesUntilClass = nextClassDate ? (nextClassDate.getTime() - Date.now()) / 60000 : Infinity;
  const isLive = minutesUntilClass <= 0 && minutesUntilClass > -(myClass?.session_duration || 30);
  const isJoinable = minutesUntilClass <= 15 || isLive;

  // ─── Pushed content kit ───
  const { data: pushedKit } = useQuery({
    queryKey: ['pushed-kit', courseId],
    queryFn: async () => {
      const { data } = await (supabase.from('content_kits')
        .select('id, session_plan_id, pushed_at') as any)
        .eq('course_id', courseId!)
        .eq('pushed_to_class', true)
        .order('pushed_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!courseId,
  });

  // ─── Kit assets ───
  const { data: kitAssets } = useQuery({
    queryKey: ['kit-assets', pushedKit?.id],
    queryFn: async () => {
      const kitId = pushedKit!.id;
      const [{ data: slides }, { data: flashcards }, { data: quizQs }] = await Promise.all([
        supabase.from('slides').select('*').eq('kit_id', kitId).order('sort_order'),
        supabase.from('flashcards').select('*').eq('kit_id', kitId).order('sort_order'),
        supabase.from('quiz_questions').select('*').eq('kit_id', kitId).order('sort_order'),
      ]);
      return { slides: slides || [], flashcards: flashcards || [], quizQuestions: quizQs || [] };
    },
    enabled: !!pushedKit?.id,
  });

  // ─── Modules & Lessons (Tab 2) ───
  const { data: modules = [] } = useQuery({
    queryKey: ['course-modules', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_modules')
        .select('id, title, sort_order')
        .eq('course_id', courseId!)
        .order('sort_order');
      return data || [];
    },
    enabled: !!courseId && activeTab === 'lessons',
  });

  const moduleIds = modules.map(m => m.id);
  const { data: lessons = [] } = useQuery({
    queryKey: ['course-lessons', moduleIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('course_lessons')
        .select('id, title, content_type, content_html, video_url, file_url, module_id, sort_order')
        .in('module_id', moduleIds)
        .order('sort_order');
      return data || [];
    },
    enabled: moduleIds.length > 0,
  });

  // ─── Assignments (Tab 3) ───
  const { data: assignments = [] } = useQuery({
    queryKey: ['student-assignments', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignments')
        .select('id, title, instructions, due_date, file_url, file_name, created_at')
        .eq('course_id', courseId!)
        .eq('status', 'active')
        .order('due_date', { ascending: true });
      return data || [];
    },
    enabled: !!courseId && activeTab === 'assignments',
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ['student-submissions', courseId, user?.id],
    queryFn: async () => {
      const assignmentIds = assignments.map(a => a.id);
      if (!assignmentIds.length) return [];
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, assignment_id, status, submitted_at, feedback, score, response_text, file_url, file_name')
        .eq('student_id', user!.id)
        .in('assignment_id', assignmentIds);
      return data || [];
    },
    enabled: !!user?.id && assignments.length > 0,
  });

  // ─── Announcements (Tab 4) ───
  const { data: announcements = [] } = useQuery({
    queryKey: ['student-announcements', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_notifications')
        .select('id, title, body, created_at, attachment_url')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!courseId && activeTab === 'announcements',
  });

  // Mark announcements seen
  useEffect(() => {
    if (activeTab === 'announcements' && courseId) {
      localStorage.setItem(`seen_announcements_${courseId}`, new Date().toISOString());
    }
  }, [activeTab, courseId]);

  const lastSeenAnnouncement = courseId ? localStorage.getItem(`seen_announcements_${courseId}`) : null;
  const hasUnreadAnnouncements = announcements.some(a =>
    a.created_at && (!lastSeenAnnouncement || new Date(a.created_at) > new Date(lastSeenAnnouncement))
  );

  // ─── Attendance (Tab 6 — Progress) ───
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['student-attendance', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('attendance')
        .select('id, class_date, status, lesson_notes')
        .eq('student_id', user!.id)
        .eq('course_id', courseId!)
        .order('class_date', { ascending: false });
      return data || [];
    },
    enabled: !!courseId && !!user?.id && activeTab === 'progress',
  });

  // ─── Certificates (Tab 6 + Tab 10) ───
  const { data: certificates = [] } = useQuery({
    queryKey: ['student-certificates', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_certificate_awards')
        .select('id, certificate_number, grade, issued_at, certificate:course_certificates(template_name)')
        .eq('student_id', user!.id)
        .eq('course_id', courseId!);
      return data || [];
    },
    enabled: !!courseId && !!user?.id && (activeTab === 'progress' || activeTab === 'certificate'),
  });

  // ─── Recordings (Tab 8) ───
  const { data: recordings = [] } = useQuery({
    queryKey: ['student-recordings', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, actual_start, actual_end, scheduled_start, recording_link, recording_status, assignment_id')
        .eq('student_id', user!.id)
        .not('recording_link', 'is', null)
        .order('actual_start', { ascending: false, nullsFirst: false });
      return data || [];
    },
    enabled: !!courseId && !!user?.id && activeTab === 'recordings',
  });

  // ─── Results: Quizzes (Tab 9) ───
  const { data: quizResults = [] } = useQuery({
    queryKey: ['student-quiz-results', courseId, user?.id],
    queryFn: async () => {
      const { data: quizzes } = await supabase.from('course_quizzes')
        .select('id, title').eq('course_id', courseId!);
      const quizIds = (quizzes || []).map(q => q.id);
      if (!quizIds.length) return [];
      const { data: attempts } = await supabase.from('course_quiz_attempts')
        .select('id, quiz_id, score, max_score, percentage, status, completed_at, started_at')
        .eq('student_id', user!.id)
        .in('quiz_id', quizIds)
        .order('started_at', { ascending: false });
      return (attempts || []).map(a => ({
        ...a,
        quiz_title: quizzes!.find(q => q.id === a.quiz_id)?.title || 'Quiz',
      }));
    },
    enabled: !!courseId && !!user?.id && activeTab === 'results',
  });

  // ─── Results: Graded assignments (Tab 9) ───
  const { data: gradedSubmissions = [] } = useQuery({
    queryKey: ['student-graded-submissions', courseId, user?.id],
    queryFn: async () => {
      const { data: courseAssignments } = await supabase.from('course_assignments')
        .select('id, title').eq('course_id', courseId!);
      const ids = (courseAssignments || []).map(a => a.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, assignment_id, score, status, submitted_at, feedback')
        .eq('student_id', user!.id)
        .in('assignment_id', ids)
        .not('score', 'is', null);
      return (data || []).map(s => ({
        ...s,
        assignment_title: courseAssignments!.find(a => a.id === s.assignment_id)?.title || 'Assignment',
      }));
    },
    enabled: !!courseId && !!user?.id && activeTab === 'results',
  });

  // ─── Resources (Tab 7) ───
  const { data: resources = [] } = useQuery({
    queryKey: ['student-course-resources', courseId, user?.id],
    queryFn: async () => {
      const { data: ras } = await supabase.from('resource_assignments')
        .select('resource_id, notes, course_id, resource:resources(id, title, type, url, folder, sub_folder)')
        .or(`assigned_to.eq.${user!.id},course_id.eq.${courseId}`);
      const seen = new Set<string>();
      return (ras || [])
        .map((r: any) => r.resource)
        .filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: !!courseId && !!user?.id && activeTab === 'resources',
  });

  // ─── Fee invoices (Tab 11) ───
  const { data: invoices = [] } = useQuery({
    queryKey: ['student-fees', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('fee_invoices')
        .select('id, billing_month, amount, amount_paid, status, due_date, currency')
        .eq('student_id', user!.id)
        .order('billing_month', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && activeTab === 'fee',
  });

  // ─── Assignment submission ───
  const handleSubmitAssignment = async () => {
    if (!submitAssignment || !user?.id) return;
    setSubmitting(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (submissionFile) {
        const filePath = `assignments/${user.id}/${Date.now()}_${submissionFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('course-materials').upload(filePath, submissionFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileName = submissionFile.name;
      }

      const { error } = await supabase.from('course_assignment_submissions').insert({
        assignment_id: submitAssignment.id,
        student_id: user.id,
        response_text: submissionText || null,
        file_url: fileUrl,
        file_name: fileName,
        status: 'submitted',
      });
      if (error) throw error;

      toast.success('Assignment submitted!');
      setSubmitDialogOpen(false);
      setSubmissionText('');
      setSubmissionFile(null);
      queryClient.invalidateQueries({ queryKey: ['student-submissions'] });
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Flashcard progress ───
  const trackFlashcard = async (flashcardId: string, isKnown: boolean) => {
    if (!user?.id) return;
    await supabase.from('flashcard_progress').upsert({
      student_id: user.id,
      flashcard_id: flashcardId,
      is_known: isKnown,
    } as any, { onConflict: 'student_id,flashcard_id' });
  };

  // ─── Quiz submission ───
  const handleSubmitQuiz = async () => {
    if (!user?.id || !pushedKit?.id) return;
    const qs = kitAssets?.quizQuestions || [];
    let score = 0;
    qs.forEach((q: any) => {
      if (quizAnswers[q.id] === q.correct_option) score++;
    });
    try {
      await supabase.from('course_quiz_attempts').insert({
        student_id: user.id,
        course_id: courseId,
        kit_id: pushedKit.id,
        answers: quizAnswers,
        score,
        total: qs.length,
      } as any);
      setQuizSubmitted(true);
      toast.success(`Quiz submitted! Score: ${score}/${qs.length}`);
    } catch {
      toast.error('Failed to submit quiz');
    }
  };

  // ─── Stats ───
  const presentCount = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = attendanceRecords.filter(a => a.status === 'absent' || a.status === 'student_absent').length;
  const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
  const attendancePct = attendanceRecords.length > 0 ? Math.round((presentCount / attendanceRecords.length) * 100) : 0;
  const submittedCount = mySubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
  const avgScore = mySubmissions.filter(s => (s as any).score != null).length > 0
    ? Math.round(mySubmissions.filter(s => (s as any).score != null).reduce((sum, s) => sum + Number((s as any).score), 0) / mySubmissions.filter(s => (s as any).score != null).length)
    : null;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* ═══ HEADER ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          {courseTeachers.length === 1 && (
            <Button variant="outline" size="sm" onClick={() => handleMessageTeacher(courseTeachers[0])} disabled={messagingTeacher}>
              {messagingTeacher ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-1" />}
              Message {courseTeachers[0].name.split(' ')[0]}
            </Button>
          )}
          {courseTeachers.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={messagingTeacher}>
                  {messagingTeacher ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-1" />}
                  Message Teacher
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {courseTeachers.map(t => (
                  <DropdownMenuItem key={t.userId} onClick={() => handleMessageTeacher(t)}>
                    {t.name} <Badge variant="secondary" className="ml-2 text-xs">{t.role}</Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-primary to-primary/60 rounded-xl p-5 text-primary-foreground">
          <h1 className="text-xl font-bold">{course?.name}</h1>
          <p className="text-sm text-primary-foreground/70 mt-0.5">
            {(course?.divisions as any)?.name}
            {course?.level && ` · ${course.level}`}
          </p>
          {enrollment && (
            <Badge className="mt-2 bg-primary-foreground/20 text-primary-foreground text-[10px]">
              Enrolled {format(new Date(enrollment.enrolled_at), 'MMM yyyy')}
            </Badge>
          )}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full overflow-x-auto justify-start h-auto flex-nowrap sticky top-0 z-10 bg-background">
          <TabsTrigger value="today" className="gap-1 shrink-0"><Video className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="lessons" className="gap-1 shrink-0"><BookOpen className="h-3.5 w-3.5" /> Lessons</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1 shrink-0"><ClipboardList className="h-3.5 w-3.5" /> Assignments</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1 shrink-0 relative">
            <Bell className="h-3.5 w-3.5" /> Announcements
            {hasUnreadAnnouncements && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />}
          </TabsTrigger>
          <TabsTrigger value="class-chat" className="gap-1 shrink-0"><MessageSquare className="h-3.5 w-3.5" /> Class Chat</TabsTrigger>
          <TabsTrigger value="progress" className="gap-1 shrink-0"><BarChart3 className="h-3.5 w-3.5" /> Progress</TabsTrigger>
          <TabsTrigger value="resources" className="gap-1 shrink-0"><FileText className="h-3.5 w-3.5" /> Resources</TabsTrigger>
          <TabsTrigger value="recordings" className="gap-1 shrink-0"><PlayCircle className="h-3.5 w-3.5" /> Recordings</TabsTrigger>
          <TabsTrigger value="results" className="gap-1 shrink-0"><GraduationCap className="h-3.5 w-3.5" /> Results</TabsTrigger>
          <TabsTrigger value="certificate" className="gap-1 shrink-0"><Award className="h-3.5 w-3.5" /> Certificate</TabsTrigger>
          <TabsTrigger value="fee" className="gap-1 shrink-0"><Receipt className="h-3.5 w-3.5" /> Fee</TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: TODAY ═══ */}
        <TabsContent value="today" className="space-y-4 mt-4">
          {/* Class panel */}
          {myClass && myClass.meeting_link ? (
            <ZoomClassPanel
              meetingLink={myClass.meeting_link as string}
              classInfo={{
                name: myClass.name,
                scheduleTime: myClass.schedule_time || '00:00',
                scheduleDays: (myClass.schedule_days as string[]) || [],
                timezone: myClass.timezone || tz,
                sessionDuration: myClass.session_duration || 30,
              }}
              userRole="student"
            />
          ) : myClass ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{myClass.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(myClass.schedule_days as string[])?.join(', ')} · {formatTime12(myClass.schedule_time || '00:00')} · {myClass.session_duration} min
                    </p>
                    {classTeacher && <p className="text-xs text-muted-foreground">Teacher: {classTeacher}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">No meeting link configured for this class yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No class assigned yet</p>
              </CardContent>
            </Card>
          )}

          {/* Pushed activities */}
          {pushedKit && kitAssets && (() => {
            const isRecent = pushedKit.pushed_at && differenceInHours(new Date(), new Date(pushedKit.pushed_at)) < 24;
            const sectionContent = (
              <div className="grid grid-cols-3 gap-3">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentSlideIdx(0); setSlidesOpen(true); }}>
                  <CardContent className="p-4 text-center">
                    <Layers className="h-6 w-6 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold text-foreground">{kitAssets.slides.length}</p>
                    <p className="text-xs text-muted-foreground">Slides</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentFlashcardIdx(0); setFlashcardFlipped(false); setFlashcardsOpen(true); }}>
                  <CardContent className="p-4 text-center">
                    <FlipVertical className="h-6 w-6 mx-auto mb-1 text-accent" />
                    <p className="text-lg font-bold text-foreground">{kitAssets.flashcards.length}</p>
                    <p className="text-xs text-muted-foreground">Flashcards</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentQuizIdx(0); setQuizAnswers({}); setQuizSubmitted(false); setQuizOpen(true); }}>
                  <CardContent className="p-4 text-center">
                    <HelpCircle className="h-6 w-6 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold text-foreground">{kitAssets.quizQuestions.length}</p>
                    <p className="text-xs text-muted-foreground">Quiz Qs</p>
                  </CardContent>
                </Card>
              </div>
            );

            if (isRecent) {
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[13px] font-bold text-foreground">📚 Today's Material</p>
                    <Badge className="bg-primary text-primary-foreground text-[10px]">New</Badge>
                  </div>
                  {sectionContent}
                </div>
              );
            }

            return (
              <details className="group">
                <summary className="text-[13px] font-bold text-muted-foreground cursor-pointer list-none flex items-center gap-2 mb-2 hover:text-foreground transition-colors">
                  📚 Previous Material
                  <ChevronLeft className="h-3.5 w-3.5 transition-transform group-open:rotate-[-90deg]" />
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {pushedKit.pushed_at && formatDistanceToNow(new Date(pushedKit.pushed_at), { addSuffix: true })}
                  </span>
                </summary>
                {sectionContent}
              </details>
            );
          })()}
        </TabsContent>

        {/* ═══ TAB 2: LESSONS ═══ */}
        <TabsContent value="lessons" className="space-y-2 mt-4">
          {modules.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No lessons available yet</p>
            </CardContent></Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {modules.map(mod => {
                const modLessons = lessons.filter(l => l.module_id === mod.id);
                return (
                  <AccordionItem key={mod.id} value={mod.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
                      {mod.title}
                      <Badge variant="secondary" className="ml-2 text-[10px]">{modLessons.length} lessons</Badge>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      {modLessons.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">No lessons in this module</p>
                      ) : (
                        <div className="space-y-1">
                          {modLessons.map(lesson => (
                            <button
                              key={lesson.id}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 text-left transition-colors"
                              onClick={() => { setSelectedLesson(lesson); setLessonSheetOpen(true); }}
                            >
                              <span className="text-sm">
                                {lesson.content_type === 'video' ? '🎬' : lesson.content_type === 'file' ? '📎' : '📄'}
                              </span>
                              <span className="text-sm text-foreground">{lesson.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        {/* ═══ TAB 3: ASSIGNMENTS ═══ */}
        <TabsContent value="assignments" className="space-y-2 mt-4">
          {assignments.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No assignments yet</p>
            </CardContent></Card>
          ) : (
            assignments.map(a => {
              const sub = mySubmissions.find(s => s.assignment_id === a.id);
              const isOverdue = a.due_date && isPast(new Date(a.due_date));
              const isDueToday = a.due_date && isToday(new Date(a.due_date));
              const canSubmit = !sub || sub.status === 'needs_revision';
              const statusBadge = sub
                ? sub.status === 'graded'
                  ? { label: 'Graded', variant: 'default' as const, color: 'bg-emerald-500' }
                  : sub.status === 'submitted'
                  ? { label: 'Submitted', variant: 'secondary' as const, color: '' }
                  : sub.status === 'needs_revision'
                  ? { label: 'Revision Needed', variant: 'outline' as const, color: 'border-orange-500 text-orange-600' }
                  : { label: sub.status, variant: 'secondary' as const, color: '' }
                : { label: 'Not Submitted', variant: 'destructive' as const, color: '' };

              return (
                <Card key={a.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{a.title}</p>
                        {a.instructions && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.instructions.slice(0, 120)}</p>}
                        {a.due_date && (
                          <p className={cn('text-xs mt-1 flex items-center gap-1',
                            isOverdue ? 'text-destructive font-semibold' : isDueToday ? 'text-gold font-semibold' : 'text-muted-foreground'
                          )}>
                            <Clock className="h-3 w-3" />
                            {isOverdue ? 'Overdue — ' : isDueToday ? 'Due today — ' : 'Due: '}
                            {format(new Date(a.due_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant={statusBadge.variant} className={cn('text-[10px] shrink-0', statusBadge.color)}>
                        {statusBadge.label}
                      </Badge>
                    </div>
                    {sub?.status === 'submitted' && sub.submitted_at && (
                      <p className="text-[10px] text-muted-foreground">Submitted {format(new Date(sub.submitted_at), 'MMM d, h:mm a')}</p>
                    )}
                    {sub?.status === 'graded' && (
                      <div className="text-xs space-y-1">
                        {(sub as any).score != null && <p className="font-semibold text-emerald-600">Score: {(sub as any).score}</p>}
                        {sub.feedback && <p className="text-muted-foreground border-t pt-1">Feedback: {sub.feedback}</p>}
                      </div>
                    )}
                    {sub?.status === 'needs_revision' && sub.feedback && (
                      <p className="text-xs text-orange-600 border-t pt-1">Feedback: {sub.feedback}</p>
                    )}
                    {canSubmit && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => { setSubmitAssignment(a); setSubmissionText(''); setSubmissionFile(null); setSubmitDialogOpen(true); }}>
                        <Upload className="h-3.5 w-3.5 mr-1" /> {sub?.status === 'needs_revision' ? 'Resubmit' : 'Submit'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ TAB 4: ANNOUNCEMENTS ═══ */}
        <TabsContent value="announcements" className="space-y-2 mt-4">
          {announcements.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <Bell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No announcements yet</p>
            </CardContent></Card>
          ) : (
            announcements.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{a.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-muted-foreground">
                      {a.created_at && format(new Date(a.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                    {(a as any).attachment_url && (
                      <Button variant="ghost" size="sm" onClick={() => window.open((a as any).attachment_url, '_blank')}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Attachment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══ TAB 5: CLASS CHAT ═══ */}
        <TabsContent value="class-chat" className="mt-4 space-y-3">
          {!myClass ? (
            <Card>
              <CardContent className="py-10 text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No class data for this enrollment.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Some features are only available in group courses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Sub-tabs: Chat | Classmates */}
              <div className="flex gap-2">
                <Button size="sm" variant={chatSubTab === 'chat' ? 'default' : 'outline'} onClick={() => setChatSubTab('chat')}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat
                </Button>
                <Button size="sm" variant={chatSubTab === 'classmates' ? 'default' : 'outline'} onClick={() => setChatSubTab('classmates')}>
                  <Users className="h-3.5 w-3.5 mr-1" /> Classmates
                </Button>
              </div>

              {chatSubTab === 'chat' && <ClassChatTab courseId={courseId!} mode="student" />}

              {chatSubTab === 'classmates' && (
                <ClassmatesDirectory
                  courseId={courseId!}
                  classId={myClass?.id || null}
                  dmMode={(course as any)?.student_dm_mode || 'disabled'}
                  userId={user?.id || ''}
                  courseName={course?.name || ''}
                  onOpenDM={(groupId, name) => { setDmGroupId(groupId); setDmRecipientName(name); setDmSheetOpen(true); }}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ TAB 6: MY PROGRESS ═══ */}
        <TabsContent value="progress" className="space-y-4 mt-4">
          {/* Attendance */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Attendance</p>
                <span className={cn('text-lg font-black', attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-gold' : 'text-destructive')}>
                  {attendancePct}%
                </span>
              </div>
              <Progress value={attendancePct} className="h-2 mb-3" />
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-lg font-bold">{attendanceRecords.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                <div><p className="text-lg font-bold text-emerald-600">{presentCount}</p><p className="text-[10px] text-muted-foreground">Present</p></div>
                <div><p className="text-lg font-bold text-destructive">{absentCount}</p><p className="text-[10px] text-muted-foreground">Absent</p></div>
                <div><p className="text-lg font-bold text-gold">{lateCount}</p><p className="text-[10px] text-muted-foreground">Late</p></div>
              </div>
              {attendanceRecords.length > 0 && (
                <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                  {attendanceRecords.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                      <span className="text-xs">{format(new Date(a.class_date), 'EEE, MMM d')}</span>
                      <div className="flex items-center gap-2">
                        {a.lesson_notes && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{a.lesson_notes}</span>}
                        <Badge variant={a.status === 'present' ? 'default' : a.status === 'late' ? 'secondary' : 'destructive'} className="text-[9px]">
                          {a.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignments */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">Assignments</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold">{submittedCount}/{assignments.length || '—'}</p><p className="text-[10px] text-muted-foreground">Submitted</p></div>
                <div><p className="text-lg font-bold">{mySubmissions.filter(s => s.status === 'graded').length}</p><p className="text-[10px] text-muted-foreground">Graded</p></div>
                <div><p className="text-lg font-bold">{avgScore != null ? avgScore : '—'}</p><p className="text-[10px] text-muted-foreground">Avg Score</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Certificates */}
          {certificates.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Award className="h-4 w-4 text-gold" /> Certificates</p>
                <div className="space-y-2">
                  {certificates.map((cert: any) => (
                    <div key={cert.id} className="flex items-center justify-between p-2 rounded bg-gold/5 border border-gold/20">
                      <div>
                        <p className="text-sm font-medium">{cert.certificate?.template_name || 'Certificate'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {cert.grade && `Grade: ${cert.grade} · `}
                          {cert.certificate_number && `#${cert.certificate_number} · `}
                          Issued {format(new Date(cert.issued_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge className="bg-gold text-foreground text-[9px]"><Award className="h-3 w-3 mr-0.5" /> Awarded</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 7: RESOURCES ═══ */}
        <TabsContent value="resources" className="space-y-2 mt-4">
          {resources.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold">No resources yet</p>
              <p className="text-xs text-muted-foreground mt-1">Course resources will appear here when shared by your teacher.</p>
            </CardContent></Card>
          ) : (
            resources.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">{r.folder}{r.sub_folder ? ` / ${r.sub_folder}` : ''} · {r.type}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open(r.url, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══ TAB 8: RECORDINGS ═══ */}
        <TabsContent value="recordings" className="space-y-2 mt-4">
          {recordings.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Video className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold">No recordings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Recordings will appear here after live classes.</p>
            </CardContent></Card>
          ) : (
            recordings.map((rec: any) => {
              const startDate = rec.actual_start || rec.scheduled_start;
              const durationMin = rec.actual_start && rec.actual_end
                ? Math.round((new Date(rec.actual_end).getTime() - new Date(rec.actual_start).getTime()) / 60000)
                : null;
              return (
                <Card key={rec.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <PlayCircle className="h-4 w-4 text-primary" /> Class Recording
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {startDate ? format(new Date(startDate), 'EEE, MMM d, yyyy · h:mm a') : 'Date unknown'}
                        {durationMin ? ` · ${durationMin} min` : ''}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => window.open(rec.recording_link, '_blank')}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1" /> Watch
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ TAB 9: RESULTS ═══ */}
        <TabsContent value="results" className="space-y-4 mt-4">
          {quizResults.length === 0 && gradedSubmissions.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold">No results yet</p>
              <p className="text-xs text-muted-foreground mt-1">Quiz scores, assignment grades, and report cards will appear here.</p>
            </CardContent></Card>
          ) : (
            <>
              {quizResults.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-3">Quizzes</p>
                    <div className="space-y-2">
                      {quizResults.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{q.quiz_title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {q.completed_at ? format(new Date(q.completed_at), 'MMM d, yyyy') : (q.started_at ? format(new Date(q.started_at), 'MMM d, yyyy') : '—')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{q.score ?? 0}/{q.max_score ?? 0}</span>
                            <Badge variant={q.status === 'completed' ? 'default' : 'secondary'} className="text-[9px]">{q.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {gradedSubmissions.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-3">Assignments</p>
                    <div className="space-y-2">
                      {gradedSubmissions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{s.assignment_title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, yyyy') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-600">{s.score}</span>
                            <Badge variant="default" className="text-[9px] bg-emerald-500">{s.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ TAB 10: CERTIFICATE ═══ */}
        <TabsContent value="certificate" className="space-y-2 mt-4">
          {certificates.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold">No certificate yet</p>
              <p className="text-xs text-muted-foreground mt-1">Earn a certificate by completing this course.</p>
            </CardContent></Card>
          ) : (
            certificates.map((cert: any) => (
              <Card key={cert.id}>
                <CardContent className="p-6 text-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <Award className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-base font-bold">{cert.certificate?.template_name || 'Certificate of Completion'}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {cert.certificate_number && <p>Certificate #: <span className="font-mono">{cert.certificate_number}</span></p>}
                    {cert.grade && <p>Grade: <span className="font-semibold">{cert.grade}</span></p>}
                    <p>Issued: {format(new Date(cert.issued_at), 'MMMM d, yyyy')}</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white">Issued</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══ TAB 11: FEE ═══ */}
        <TabsContent value="fee" className="space-y-4 mt-4">
          {invoices.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Receipt className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-1">Fee invoices will appear here once generated.</p>
            </CardContent></Card>
          ) : (() => {
            const outstanding = invoices.reduce((sum: number, i: any) =>
              i.status !== 'paid' ? sum + (Number(i.amount) - Number(i.amount_paid || 0)) : sum, 0);
            const thisMonthKey = format(new Date(), 'yyyy-MM');
            const paidThisMonth = invoices
              .filter((i: any) => i.billing_month?.startsWith(thisMonthKey) && i.status === 'paid')
              .reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
            const nextDue = invoices
              .filter((i: any) => i.status !== 'paid' && i.due_date)
              .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
            const currency = invoices[0]?.currency || 'USD';
            const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;
            return (
              <>
                <p className="text-[11px] text-muted-foreground">All your fee invoices.</p>
                <div className="grid grid-cols-3 gap-3">
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Outstanding</p>
                    <p className={cn("text-base font-bold mt-1", outstanding > 0 ? "text-destructive" : "text-emerald-600")}>{fmt(outstanding)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Paid this month</p>
                    <p className="text-base font-bold text-emerald-600 mt-1">{fmt(paidThisMonth)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Next due</p>
                    <p className="text-xs font-semibold mt-1">{nextDue?.due_date ? format(new Date(nextDue.due_date), 'MMM d') : '—'}</p>
                  </CardContent></Card>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <th className="p-2.5 font-medium">Month</th>
                            <th className="p-2.5 font-medium">Amount</th>
                            <th className="p-2.5 font-medium">Paid</th>
                            <th className="p-2.5 font-medium">Status</th>
                            <th className="p-2.5 font-medium">Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv: any) => {
                            const isOverdue = inv.status !== 'paid' && inv.due_date && isPast(new Date(inv.due_date));
                            const statusLabel = isOverdue ? 'overdue' : inv.status;
                            const statusColor =
                              statusLabel === 'paid' ? 'bg-emerald-500 text-white' :
                              statusLabel === 'overdue' ? 'bg-destructive text-white' :
                              'bg-amber-500 text-white';
                            return (
                              <tr key={inv.id} className="border-t">
                                <td className="p-2.5">{inv.billing_month}</td>
                                <td className="p-2.5">{inv.currency} {Number(inv.amount).toFixed(2)}</td>
                                <td className="p-2.5">{inv.currency} {Number(inv.amount_paid || 0).toFixed(2)}</td>
                                <td className="p-2.5"><Badge className={cn("text-[9px]", statusColor)}>{statusLabel}</Badge></td>
                                <td className="p-2.5">{inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* ═══ DIALOGS ═══ */}

      {/* Slides dialog */}
      <Dialog open={slidesOpen} onOpenChange={setSlidesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Slides ({currentSlideIdx + 1}/{kitAssets?.slides.length || 0})</DialogTitle>
          </DialogHeader>
          {kitAssets?.slides[currentSlideIdx] && (() => {
            const slide = kitAssets.slides[currentSlideIdx] as any;
            return (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">{slide.title}</h3>
                {slide.arabic_text && <p className="text-xl text-right font-arabic leading-relaxed" dir="rtl">{slide.arabic_text}</p>}
                {slide.bullets && (
                  <ul className="space-y-1">
                    {(Array.isArray(slide.bullets) ? slide.bullets : []).map((b: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span> {b}
                      </li>
                    ))}
                  </ul>
                )}
                {slide.teacher_note && <p className="text-xs text-muted-foreground italic border-t pt-2">Note: {slide.teacher_note}</p>}
                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" disabled={currentSlideIdx === 0} onClick={() => setCurrentSlideIdx(i => i - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentSlideIdx >= (kitAssets?.slides.length || 1) - 1} onClick={() => setCurrentSlideIdx(i => i + 1)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Flashcards dialog */}
      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Flashcards ({currentFlashcardIdx + 1}/{kitAssets?.flashcards.length || 0})</DialogTitle>
          </DialogHeader>
          {kitAssets?.flashcards[currentFlashcardIdx] && (() => {
            const fc = kitAssets.flashcards[currentFlashcardIdx] as any;
            return (
              <div className="space-y-4">
                <div
                  className="min-h-[200px] rounded-xl border-2 border-primary/20 p-6 flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                >
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase mb-2">{flashcardFlipped ? 'Answer' : 'Question'}</p>
                    <p className="text-lg font-semibold">{flashcardFlipped ? fc.back_content : fc.front_content}</p>
                    <p className="text-[10px] text-primary mt-3">Tap to flip</p>
                  </div>
                </div>
                {flashcardFlipped && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-destructive/30 text-destructive" onClick={() => {
                      trackFlashcard(fc.id, false);
                      toast('Marked as needs review');
                      setFlashcardFlipped(false);
                      if (currentFlashcardIdx < (kitAssets?.flashcards.length || 1) - 1) setCurrentFlashcardIdx(i => i + 1);
                    }}>
                      <X className="h-4 w-4 mr-1" /> Don't Know
                    </Button>
                    <Button variant="outline" className="flex-1 border-emerald-500/30 text-emerald-600" onClick={() => {
                      trackFlashcard(fc.id, true);
                      toast.success('Marked as known!');
                      setFlashcardFlipped(false);
                      if (currentFlashcardIdx < (kitAssets?.flashcards.length || 1) - 1) setCurrentFlashcardIdx(i => i + 1);
                    }}>
                      <Check className="h-4 w-4 mr-1" /> Got It
                    </Button>
                  </div>
                )}
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" disabled={currentFlashcardIdx === 0} onClick={() => { setCurrentFlashcardIdx(i => i - 1); setFlashcardFlipped(false); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={currentFlashcardIdx >= (kitAssets?.flashcards.length || 1) - 1} onClick={() => { setCurrentFlashcardIdx(i => i + 1); setFlashcardFlipped(false); }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz ({currentQuizIdx + 1}/{kitAssets?.quizQuestions.length || 0})</DialogTitle>
          </DialogHeader>
          {kitAssets?.quizQuestions[currentQuizIdx] && !quizSubmitted && (() => {
            const q = kitAssets.quizQuestions[currentQuizIdx] as any;
            const options: string[] = q.options || [];
            return (
              <div className="space-y-4">
                <p className="text-sm font-semibold">{q.question_text || q.question}</p>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <button
                      key={i}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border text-sm transition-colors',
                        quizAnswers[q.id] === opt ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted/50',
                      )}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" disabled={currentQuizIdx === 0} onClick={() => setCurrentQuizIdx(i => i - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  {currentQuizIdx < (kitAssets?.quizQuestions.length || 1) - 1 ? (
                    <Button size="sm" onClick={() => setCurrentQuizIdx(i => i + 1)} disabled={!quizAnswers[q.id]}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleSubmitQuiz} disabled={Object.keys(quizAnswers).length < (kitAssets?.quizQuestions.length || 0)}>
                      Submit Quiz
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          {quizSubmitted && (
            <div className="py-6 text-center">
              <Check className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="text-lg font-bold">Quiz Submitted!</p>
              <p className="text-sm text-muted-foreground mt-1">Your answers have been recorded.</p>
              <Button className="mt-4" onClick={() => setQuizOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lesson sheet */}
      <Sheet open={lessonSheetOpen} onOpenChange={setLessonSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedLesson?.title}</SheetTitle>
          </SheetHeader>
          {selectedLesson && (
            <div className="mt-4">
              {selectedLesson.content_type === 'text' && selectedLesson.content_html && (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }} />
              )}
              {selectedLesson.content_type === 'video' && selectedLesson.video_url && (
                <iframe src={selectedLesson.video_url} className="w-full aspect-video rounded-lg" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
              )}
              {selectedLesson.content_type === 'file' && selectedLesson.file_url && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <Button onClick={() => window.open(selectedLesson.file_url, '_blank')}>
                    <Download className="h-4 w-4 mr-2" /> Download File
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Assignment submission dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit: {submitAssignment?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Your Response</Label>
              <Textarea
                value={submissionText}
                onChange={e => setSubmissionText(e.target.value)}
                placeholder="Type your response here..."
                rows={4}
              />
            </div>
            <div>
              <Label className="text-sm">Attach File (optional)</Label>
              <Input type="file" onChange={e => setSubmissionFile(e.target.files?.[0] || null)} className="mt-1" />
            </div>
            <Button className="w-full" onClick={handleSubmitAssignment} disabled={submitting || (!submissionText.trim() && !submissionFile)}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Submit Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DM Chat Sheet */}
      <DMChatSheet open={dmSheetOpen} onOpenChange={setDmSheetOpen} groupId={dmGroupId} recipientName={dmRecipientName} />
    </div>
  );
}
