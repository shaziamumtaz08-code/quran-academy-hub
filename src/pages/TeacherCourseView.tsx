import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, isToday, isPast, addDays } from 'date-fns';
import { toast } from 'sonner';
import { findOrCreateCourseDM } from '@/lib/messaging';
import { TeachTodayTab } from '@/components/courses/TeachTodayTab';
import { ClassChatTab } from '@/components/courses/ClassChatTab';
import { ZoomClassPanel } from '@/components/classroom/ZoomClassPanel';
import {
  ArrowLeft, Video, Calendar, FileText, Bell, BarChart3,
  BookOpen, Users, Clock, ExternalLink, X, Check, ChevronDown,
  Loader2, Upload, Download, MessageSquare, Sparkles, Send, Plus, AlertTriangle
} from 'lucide-react';
import { DMChatSheet } from '@/components/chat/DMChatSheet';
import { GradingPanel } from '@/components/assignments/GradingPanel';

// ─── Helpers ───
function formatTime12(time: string) {
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function TeacherCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const initialTab = searchParams.get('tab') || 'today';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Attendance
  const [attendanceState, setAttendanceState] = useState<Record<string, { status: string; notes: string }>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Live class
  const [showZoomIframe, setShowZoomIframe] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Assignments
  const [assignSubTab, setAssignSubTab] = useState<'create' | 'submissions'>('submissions');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Grading sheet
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);

  // Lesson planner
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonObjectives, setLessonObjectives] = useState('');
  const [lessonStatus, setLessonStatus] = useState('planned');

  // Announcements
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementFile, setAnnouncementFile] = useState<File | null>(null);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // DM
  const [dmLoading, setDmLoading] = useState<string | null>(null);
  const [dmSheetOpen, setDmSheetOpen] = useState(false);
  const [dmGroupId, setDmGroupId] = useState<string | null>(null);
  const [dmRecipientName, setDmRecipientName] = useState('');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ─── Course ───
  const { data: course, isLoading } = useQuery({
    queryKey: ['teacher-course', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name, level, description, division_id, divisions:divisions(name)').eq('id', courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  // ─── My classes ───
  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-my-classes', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_staff')
        .select('id, staff_role, class:course_classes!inner(id, name, schedule_days, schedule_time, session_duration, meeting_link, max_seats, course_id)')
        .eq('user_id', user!.id).eq('class.course_id', courseId!);
      return data || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  // Auto-select first class
  useEffect(() => {
    if (myClasses.length > 0 && !selectedClassId) {
      setSelectedClassId((myClasses[0] as any)?.class?.id || null);
    }
  }, [myClasses, selectedClassId]);

  const selectedClass = useMemo(() => {
    const mc = myClasses.find((mc: any) => mc.class?.id === selectedClassId) as any;
    return mc?.class || null;
  }, [myClasses, selectedClassId]);

  // ─── Students in selected class ───
  const { data: classStudents = [] } = useQuery({
    queryKey: ['class-students', selectedClassId],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_students')
        .select('id, student_id, profile:profiles!course_class_students_student_id_fkey(id, full_name, email, photo_url)')
        .eq('class_id', selectedClassId!).eq('status', 'active');
      return data || [];
    },
    enabled: !!selectedClassId,
  });

  // ─── Assignments ───
  const { data: assignments = [] } = useQuery({
    queryKey: ['teacher-assignments', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignments')
        .select('id, title, instructions, due_date, file_url, file_name, created_at, status')
        .eq('course_id', courseId!).eq('status', 'active').order('due_date', { ascending: true });
      return data || [];
    },
    enabled: !!courseId && activeTab === 'assignments',
  });

  const { data: allSubmissions = [] } = useQuery({
    queryKey: ['teacher-all-submissions', courseId],
    queryFn: async () => {
      const ids = assignments.map(a => a.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, assignment_id, student_id, status, submitted_at, feedback, score, response_text, file_url, file_name, graded_at')
        .in('assignment_id', ids);
      return data || [];
    },
    enabled: assignments.length > 0,
  });

  // ─── Lesson plans ───
  const { data: lessonPlans = [] } = useQuery({
    queryKey: ['teacher-lesson-plans', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_lesson_plans')
        .select('id, week_number, lesson_date, topic, objectives, status, notes, material_title, material_url')
        .eq('course_id', courseId!).order('week_number').order('lesson_date');
      return data || [];
    },
    enabled: !!courseId && activeTab === 'lesson-planner',
  });

  // ─── Announcements ───
  const { data: pastAnnouncements = [] } = useQuery({
    queryKey: ['teacher-announcements', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_notifications')
        .select('id, title, body, created_at, attachment_url')
        .eq('course_id', courseId!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!courseId && activeTab === 'announcements',
  });

  // ─── Student progress data ───
  const { data: attendanceByStudent = [] } = useQuery({
    queryKey: ['student-progress-attendance', courseId],
    queryFn: async () => {
      const sIds = classStudents.map((s: any) => s.student_id);
      if (!sIds.length) return [];
      const { data } = await supabase.from('attendance')
        .select('id, student_id, status').eq('course_id', courseId!).in('student_id', sIds);
      return data || [];
    },
    enabled: classStudents.length > 0 && activeTab === 'students',
  });

  const { data: progressSubmissions = [] } = useQuery({
    queryKey: ['student-progress-submissions', courseId],
    queryFn: async () => {
      const aIds = assignments.map(a => a.id);
      const sIds = classStudents.map((s: any) => s.student_id);
      if (!aIds.length || !sIds.length) return [];
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, student_id, status, score').in('assignment_id', aIds).in('student_id', sIds);
      return data || [];
    },
    enabled: classStudents.length > 0 && assignments.length > 0 && activeTab === 'students',
  });

  // ─── Enrolled count for announcements ───
  const { data: enrolledCount } = useQuery({
    queryKey: ['enrolled-count', courseId],
    queryFn: async () => {
      const { count } = await supabase.from('course_enrollments').select('id', { count: 'exact', head: true }).eq('course_id', courseId!).eq('status', 'active');
      return count || 0;
    },
    enabled: !!courseId,
  });

  // ═══ HANDLERS ═══

  const handleSaveAttendance = async () => {
    const entries = Object.entries(attendanceState).filter(([, v]) => v.status);
    if (!entries.length) { toast.error('Mark at least one student'); return; }
    setSavingAttendance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = entries.map(([studentId, val]) => ({
        student_id: studentId, teacher_id: user!.id, course_id: courseId!,
        class_date: today, class_time: new Date().toTimeString().slice(0, 5),
        status: val.status, lesson_notes: val.notes || null, duration_minutes: selectedClass?.session_duration || 30,
        lesson_type: 'academic',
      }));
      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;
      toast.success(`Attendance saved for ${entries.length} students`);
      setAttendanceState({});
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingAttendance(false); }
  };

  const handleCreateAssignment = async () => {
    if (!assignTitle.trim()) { toast.error('Title required'); return; }
    setCreatingAssignment(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (assignFile) {
        const path = `assignments/${user!.id}/${Date.now()}_${assignFile.name}`;
        const { error: ue } = await supabase.storage.from('course-materials').upload(path, assignFile);
        if (ue) throw ue;
        const { data: ud } = supabase.storage.from('course-materials').getPublicUrl(path);
        fileUrl = ud.publicUrl; fileName = assignFile.name;
      }
      const { error } = await supabase.from('course_assignments').insert({
        course_id: courseId!, title: assignTitle.trim(), instructions: assignInstructions.trim() || null,
        due_date: assignDueDate || null, file_url: fileUrl, file_name: fileName,
        created_by: user!.id, status: 'active',
      });
      if (error) throw error;
      toast.success('Assignment created');
      setAssignTitle(''); setAssignInstructions(''); setAssignDueDate(''); setAssignFile(null);
      setAssignSubTab('submissions');
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setCreatingAssignment(false); }
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission) return;
    setSavingGrade(true);
    try {
      const { error } = await supabase.from('course_assignment_submissions').update({
        score: gradeScore ? Number(gradeScore) : null,
        feedback: gradeFeedback || null,
        status: gradeStatus,
        graded_by: user!.id,
        graded_at: new Date().toISOString(),
      }).eq('id', gradingSubmission.id);
      if (error) throw error;
      toast.success('Grade saved');
      setGradingSubmission(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-all-submissions'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingGrade(false); }
  };

  const handleSaveLessonPlan = async () => {
    if (!editingLesson) return;
    try {
      const { error } = await supabase.from('course_lesson_plans').update({
        topic: lessonTopic, objectives: lessonObjectives || null, status: lessonStatus,
      }).eq('id', editingLesson.id);
      if (error) throw error;
      toast.success('Lesson plan updated');
      setEditingLesson(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-lesson-plans'] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddWeek = async () => {
    const maxWeek = lessonPlans.length > 0 ? Math.max(...lessonPlans.map(l => l.week_number)) : 0;
    try {
      const { error } = await supabase.from('course_lesson_plans').insert({
        course_id: courseId!, week_number: maxWeek + 1, topic: 'New lesson', status: 'planned',
      });
      if (error) throw error;
      toast.success('Week added');
      queryClient.invalidateQueries({ queryKey: ['teacher-lesson-plans'] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleMarkWeekDelivered = async (weekNum: number) => {
    const ids = lessonPlans.filter(l => l.week_number === weekNum).map(l => l.id);
    if (!ids.length) return;
    try {
      const { error } = await supabase.from('course_lesson_plans').update({ status: 'delivered' }).in('id', ids);
      if (error) throw error;
      toast.success(`Week ${weekNum} marked as delivered`);
      queryClient.invalidateQueries({ queryKey: ['teacher-lesson-plans'] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim()) { toast.error('Title required'); return; }
    setSendingAnnouncement(true);
    try {
      let attachmentUrl: string | null = null;
      if (announcementFile) {
        const path = `announcements/${user!.id}/${Date.now()}_${announcementFile.name}`;
        const { error: ue } = await supabase.storage.from('course-materials').upload(path, announcementFile);
        if (ue) throw ue;
        const { data: ud } = supabase.storage.from('course-materials').getPublicUrl(path);
        attachmentUrl = ud.publicUrl;
      }
      const { error } = await supabase.from('course_notifications').insert({
        course_id: courseId!, title: announcementTitle.trim(), body: announcementBody.trim() || null,
        attachment_url: attachmentUrl, sent_by: user!.id,
      });
      if (error) throw error;
      toast.success('Announcement sent');
      setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementFile(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSendingAnnouncement(false); }
  };

  const handleDMStudent = async (studentId: string, studentName: string) => {
    if (!user?.id || !courseId) return;
    setDmLoading(studentId);
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const dmId = await findOrCreateCourseDM(user.id, studentId, courseId, course?.name || '', profile?.full_name || '', studentName);
      if (dmId) {
        setDmGroupId(dmId);
        setDmRecipientName(studentName);
        setDmSheetOpen(true);
      } else toast.error('Could not create conversation');
    } catch { toast.error('Failed'); }
    finally { setDmLoading(null); }
  };

  // ─── Profile map for submissions ───
  const allStudentIds = classStudents.map((s: any) => s.student_id);
  const profileMap = new Map(classStudents.map((s: any) => [s.student_id, s.profile]));

  if (isLoading) {
    return <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-10 w-full" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* ═══ HEADER ═══ */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Button>
        <div className="bg-gradient-to-r from-primary to-primary/60 rounded-xl p-5 text-primary-foreground">
          <h1 className="text-xl font-bold">{course?.name}</h1>
          <p className="text-sm text-primary-foreground/70 mt-0.5">
            {(course?.divisions as any)?.name}{course?.level && ` · ${course.level}`}
          </p>
          {/* Class selector */}
          {myClasses.length > 1 && (
            <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
              <SelectTrigger className="mt-2 w-52 bg-primary-foreground/20 border-primary-foreground/20 text-primary-foreground h-8 text-xs">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {myClasses.map((mc: any) => (
                  <SelectItem key={mc.class?.id} value={mc.class?.id}>{mc.class?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {myClasses.length === 1 && selectedClass && (
            <Badge className="mt-2 bg-primary-foreground/20 text-primary-foreground text-[10px]">{selectedClass.name}</Badge>
          )}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full overflow-x-auto justify-start h-auto flex-nowrap sticky top-0 z-10 bg-background">
          <TabsTrigger value="today" className="gap-1 shrink-0"><Video className="h-3.5 w-3.5" /> Today's Class</TabsTrigger>
          <TabsTrigger value="teach" className="gap-1 shrink-0"><Sparkles className="h-3.5 w-3.5" /> Teach Today</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1 shrink-0"><FileText className="h-3.5 w-3.5" /> Assignments</TabsTrigger>
          <TabsTrigger value="lesson-planner" className="gap-1 shrink-0"><BookOpen className="h-3.5 w-3.5" /> Lesson Planner</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1 shrink-0"><Bell className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
          <TabsTrigger value="students" className="gap-1 shrink-0"><BarChart3 className="h-3.5 w-3.5" /> Student Progress</TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: TODAY'S CLASS ═══ */}
        <TabsContent value="today" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* LEFT: Attendance */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Attendance — {format(new Date(), 'EEEE, MMM d')}</h3>
                <Button size="sm" onClick={handleSaveAttendance} disabled={savingAttendance}>
                  {savingAttendance ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Submit Attendance
                </Button>
              </div>
              {classStudents.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />No students in this class</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[35%]">Name</TableHead>
                          <TableHead className="w-[30%]">Status</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map((s: any) => {
                          const st = attendanceState[s.student_id] || { status: '', notes: '' };
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                    {(s.profile?.full_name || 'S').charAt(0)}
                                  </div>
                                  <span className="text-sm truncate">{s.profile?.full_name || 'Student'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex gap-1">
                                  {(['present', 'late', 'absent'] as const).map(status => (
                                    <Button key={status} size="sm" variant={st.status === status ? 'default' : 'outline'}
                                      className={cn('text-xs px-2 h-7',
                                        st.status === status && status === 'present' && 'bg-emerald-600 hover:bg-emerald-700',
                                        st.status === status && status === 'late' && 'bg-amber-600 hover:bg-amber-700',
                                        st.status === status && status === 'absent' && 'bg-destructive hover:bg-destructive/90',
                                      )}
                                      onClick={() => setAttendanceState(prev => ({ ...prev, [s.student_id]: { ...prev[s.student_id], status } }))}>
                                      {status === 'present' ? 'P' : status === 'late' ? 'L' : 'A'}
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <Input className="h-7 text-xs" placeholder="Notes..."
                                  value={st.notes || ''}
                                  onChange={e => setAttendanceState(prev => ({ ...prev, [s.student_id]: { ...prev[s.student_id], notes: e.target.value } }))} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT: Live Class */}
            <div className="md:col-span-5 space-y-3">
              <h3 className="text-sm font-semibold">Live Class</h3>
              {selectedClass?.meeting_link ? (
                <ZoomClassPanel
                  meetingLink={selectedClass.meeting_link as string}
                  classInfo={{
                    name: selectedClass.name,
                    scheduleTime: selectedClass.schedule_time || '00:00',
                    scheduleDays: (selectedClass.schedule_days as string[]) || [],
                    timezone: selectedClass.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                    sessionDuration: selectedClass.session_duration || 30,
                  }}
                  userRole="teacher"
                  onSessionEnd={() => handleTabChange('today')}
                />
              ) : selectedClass ? (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{selectedClass.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedClass.schedule_days as string[])?.join(', ')} · {formatTime12(selectedClass.schedule_time || '00:00')} · {selectedClass.session_duration} min
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">No meeting link configured yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No class selected</CardContent></Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ TAB 2: TEACH TODAY ═══ */}
        <TabsContent value="teach" className="mt-4">
          <TeachTodayTab courseId={courseId!} />
        </TabsContent>

        {/* ═══ TAB 3: ASSIGNMENTS ═══ */}
        <TabsContent value="assignments" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button size="sm" variant={assignSubTab === 'submissions' ? 'default' : 'outline'} onClick={() => setAssignSubTab('submissions')}>Submissions</Button>
            <Button size="sm" variant={assignSubTab === 'create' ? 'default' : 'outline'} onClick={() => setAssignSubTab('create')}>+ Create</Button>
          </div>

          {assignSubTab === 'create' && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div><Label className="text-xs">Title</Label><Input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="Assignment title" /></div>
                <div><Label className="text-xs">Instructions</Label><Textarea value={assignInstructions} onChange={e => setAssignInstructions(e.target.value)} rows={3} placeholder="Instructions for students..." /></div>
                <div><Label className="text-xs">Due Date</Label><Input type="datetime-local" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} /></div>
                <div><Label className="text-xs">Attachment (optional)</Label><Input type="file" onChange={e => setAssignFile(e.target.files?.[0] || null)} /></div>
                <Button className="w-full" onClick={handleCreateAssignment} disabled={creatingAssignment}>
                  {creatingAssignment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Create Assignment
                </Button>
              </CardContent>
            </Card>
          )}

          {assignSubTab === 'submissions' && (
            <>
              {assignments.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />No assignments yet
                </CardContent></Card>
              ) : (
                assignments.map(a => {
                  const subs = allSubmissions.filter(s => s.assignment_id === a.id);
                  return (
                    <Collapsible key={a.id}>
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="text-left">
                              <p className="text-sm font-semibold">{a.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.due_date && `Due: ${format(new Date(a.due_date), 'MMM d, yyyy')}`} · {subs.length}/{classStudents.length} submitted
                              </p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead>Submitted</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Score</TableHead>
                                  <TableHead>Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {subs.length === 0 ? (
                                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">No submissions yet</TableCell></TableRow>
                                ) : subs.map(sub => {
                                  const profile = profileMap.get(sub.student_id);
                                  return (
                                    <TableRow key={sub.id}>
                                      <TableCell className="text-sm">{(profile as any)?.full_name || 'Student'}</TableCell>
                                      <TableCell className="text-xs">{sub.submitted_at && format(new Date(sub.submitted_at), 'MMM d, h:mm a')}</TableCell>
                                      <TableCell>
                                        <Badge variant={sub.status === 'graded' ? 'default' : sub.status === 'submitted' ? 'secondary' : 'outline'}
                                          className={cn('text-[9px]', sub.status === 'graded' && 'bg-emerald-500', sub.status === 'needs_revision' && 'border-orange-500 text-orange-600')}>
                                          {sub.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm">{(sub as any).score ?? '—'}</TableCell>
                                      <TableCell>
                                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                          setGradingSubmission(sub);
                                          setGradeScore(String((sub as any).score ?? ''));
                                          setGradeFeedback(sub.feedback || '');
                                          setGradeStatus(sub.status === 'submitted' ? 'graded' : sub.status);
                                        }}>Review</Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ TAB 4: LESSON PLANNER ═══ */}
        <TabsContent value="lesson-planner" className="space-y-3 mt-4">
          {lessonPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />No lesson plans yet
            </CardContent></Card>
          ) : (() => {
            const weeks = [...new Set(lessonPlans.map(l => l.week_number))].sort((a, b) => a - b);
            return weeks.map(wk => (
              <div key={wk}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Week {wk}</p>
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => handleMarkWeekDelivered(wk)}>Mark Delivered</Button>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead><TableHead>Topic</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {lessonPlans.filter(l => l.week_number === wk).map(lp => (
                          <TableRow key={lp.id}>
                            <TableCell className="text-xs">{lp.lesson_date ? format(new Date(lp.lesson_date), 'MMM d') : '—'}</TableCell>
                            <TableCell className="text-sm">{lp.topic}</TableCell>
                            <TableCell>
                              <Badge variant={lp.status === 'delivered' ? 'default' : lp.status === 'skipped' ? 'destructive' : 'secondary'}
                                className={cn('text-[9px]', lp.status === 'delivered' && 'bg-emerald-500')}>
                                {lp.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
                                setEditingLesson(lp); setLessonTopic(lp.topic); setLessonObjectives(lp.objectives || ''); setLessonStatus(lp.status);
                              }}>Edit</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ));
          })()}
          <Button variant="outline" className="w-full" onClick={handleAddWeek}><Plus className="h-4 w-4 mr-1" /> Add Week</Button>
        </TabsContent>

        {/* ═══ TAB 5: ANNOUNCEMENTS ═══ */}
        <TabsContent value="announcements" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">New Announcement</p>
              <div><Label className="text-xs">Title</Label><Input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} placeholder="Announcement title" /></div>
              <div><Label className="text-xs">Body</Label><Textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} rows={3} placeholder="Message to students..." /></div>
              <div><Label className="text-xs">Attachment (optional)</Label><Input type="file" onChange={e => setAnnouncementFile(e.target.files?.[0] || null)} /></div>
              <Button className="w-full" onClick={handleSendAnnouncement} disabled={sendingAnnouncement}>
                {sendingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Send Announcement
              </Button>
            </CardContent>
          </Card>
          {pastAnnouncements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Past Announcements</p>
              {pastAnnouncements.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-3">
                    <p className="text-sm font-semibold">{a.title}</p>
                    {a.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{a.created_at && format(new Date(a.created_at), 'MMM d, yyyy · h:mm a')}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB 6: STUDENT PROGRESS ═══ */}
        <TabsContent value="students" className="mt-4">
          {classStudents.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />No students in this class</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Attendance %</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Avg Score</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {classStudents.map((s: any) => {
                      const profile = s.profile;
                      const attRecords = attendanceByStudent.filter(a => a.student_id === s.student_id);
                      const presentCount = attRecords.filter(a => a.status === 'present' || a.status === 'late').length;
                      const attPct = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 0;
                      const stuSubs = progressSubmissions.filter(ps => ps.student_id === s.student_id);
                      const submittedCount = stuSubs.filter(ps => ps.status === 'submitted' || ps.status === 'graded').length;
                      const scores = stuSubs.filter(ps => (ps as any).score != null).map(ps => Number((ps as any).score));
                      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                {(profile?.full_name || 'S').charAt(0)}
                              </div>
                              <span className="text-sm">{profile?.full_name || 'Student'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn('text-sm font-semibold', attPct >= 80 ? 'text-emerald-600' : attPct >= 50 ? 'text-amber-600' : 'text-destructive')}>
                              {attPct}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{submittedCount}/{assignments.length || '—'}</TableCell>
                          <TableCell className="text-sm">{avgScore != null ? avgScore : '—'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="text-xs h-7" disabled={dmLoading === s.student_id}
                              onClick={() => handleDMStudent(s.student_id, profile?.full_name || 'Student')}>
                              {dmLoading === s.student_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ DIALOGS ═══ */}

      {/* Grading sheet */}
      <Sheet open={!!gradingSubmission} onOpenChange={o => { if (!o) setGradingSubmission(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Review Submission</SheetTitle></SheetHeader>
          {gradingSubmission && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Student</p>
                <p className="text-sm font-medium">{(profileMap.get(gradingSubmission.student_id) as any)?.full_name || 'Student'}</p>
              </div>
              {gradingSubmission.submitted_at && (
                <p className="text-xs text-muted-foreground">Submitted {format(new Date(gradingSubmission.submitted_at), 'MMM d, h:mm a')}</p>
              )}
              {gradingSubmission.response_text && (
                <div>
                  <Label className="text-xs">Response</Label>
                  <Textarea value={gradingSubmission.response_text} readOnly rows={4} className="bg-muted/50" />
                </div>
              )}
              {gradingSubmission.file_url && (
                <Button variant="outline" size="sm" onClick={() => window.open(gradingSubmission.file_url, '_blank')}>
                  <Download className="h-4 w-4 mr-1" /> Download Submission
                </Button>
              )}
              <div>
                <Label className="text-xs">Score (0-100)</Label>
                <Input type="number" min={0} max={100} value={gradeScore} onChange={e => setGradeScore(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Feedback</Label>
                <Textarea value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} rows={3} placeholder="Feedback for student..." />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={gradeStatus} onValueChange={setGradeStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="graded">Graded</SelectItem>
                    <SelectItem value="needs_revision">Needs Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSaveGrade} disabled={savingGrade}>
                {savingGrade ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Save Grade
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lesson edit dialog */}
      <Dialog open={!!editingLesson} onOpenChange={o => { if (!o) setEditingLesson(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Lesson Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Topic</Label><Textarea value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} rows={2} /></div>
            <div><Label className="text-xs">Objectives</Label><Textarea value={lessonObjectives} onChange={e => setLessonObjectives(e.target.value)} rows={2} /></div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={lessonStatus} onValueChange={setLessonStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveLessonPlan}><Check className="h-4 w-4 mr-1" /> Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DM Chat Sheet */}
      <DMChatSheet open={dmSheetOpen} onOpenChange={setDmSheetOpen} groupId={dmGroupId} recipientName={dmRecipientName} />
    </div>
  );
}
