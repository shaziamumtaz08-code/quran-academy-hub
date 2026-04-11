import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { CourseDiscussionBoard } from '@/components/courses/CourseDiscussionBoard';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, BookOpen, Calendar, FileText, ClipboardList,
  GraduationCap, MessageSquare, Video, Clock, ExternalLink, Loader2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { findOrCreateCourseDM, getCourseTeachers } from '@/lib/messaging';

// ─── Helpers ───
function isClassToday(scheduleDays: string[]): boolean {
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayName = dayNames[new Date().getDay()];
  return scheduleDays?.some(d => d.toLowerCase().startsWith(todayName)) ?? false;
}

function getClassStatus(scheduleDays: string[], startTime: string, durationMinutes: number): 'upcoming' | 'live' | 'ended' | 'not_today' {
  if (!isClassToday(scheduleDays)) return 'not_today';
  const now = new Date();
  const [hours, minutes] = (startTime || '00:00').split(':').map(Number);
  const classStart = new Date();
  classStart.setHours(hours, minutes, 0, 0);
  const classEnd = new Date(classStart.getTime() + durationMinutes * 60000);
  const joinWindow = new Date(classStart.getTime() - 15 * 60000);

  if (now >= joinWindow && now < classStart) return 'upcoming';
  if (now >= classStart && now <= classEnd) return 'live';
  if (now > classEnd) return 'ended';
  return 'not_today';
}

export default function StudentCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [messagingTeacher, setMessagingTeacher] = useState(false);

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
      const dmId = await findOrCreateCourseDM(
        user.id,
        teacher.userId,
        courseId,
        course?.name || '',
        profile?.full_name || '',
        teacher.name,
      );
      if (dmId) {
        navigate(`/communication?group=${dmId}`);
      } else {
        toast.error('Failed to create conversation');
      }
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setMessagingTeacher(false);
    }
  };

  // ─── Course details ───
  const { data: course, isLoading } = useQuery({
    queryKey: ['student-course', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, description, division_id, divisions:divisions(name)')
        .eq('id', courseId!)
        .single();
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
        .eq('course_id', courseId!)
        .eq('student_id', user!.id)
        .single();
      return data;
    },
    enabled: !!courseId && !!user?.id,
  });

  // ─── My class assignment ───
  const { data: myClass } = useQuery({
    queryKey: ['student-class', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_students')
        .select('id, class:course_classes!inner(id, name, schedule_days, schedule_time, session_duration, meeting_link, timezone, course_id)')
        .eq('student_id', user!.id)
        .eq('class.course_id', courseId!);
      return (data?.[0] as any)?.class || null;
    },
    enabled: !!courseId && !!user?.id,
  });

  // ─── My attendance ───
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['student-attendance', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('attendance')
        .select('id, class_date, status')
        .eq('student_id', user!.id)
        .eq('course_id', courseId!)
        .order('class_date', { ascending: false });
      return data || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  // ─── Teaching OS syllabus ───
  const { data: syllabus } = useQuery({
    queryKey: ['student-syllabus', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('syllabi')
        .select('id, rows, duration_weeks, sessions_week, subject, level')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!courseId,
  });

  // ─── Materials ───
  const { data: materials = [] } = useQuery({
    queryKey: ['student-materials', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_library_assets')
        .select('id, title, asset_type, content_url, created_at')
        .eq('course_id', courseId!);
      return data || [];
    },
    enabled: !!courseId && activeTab === 'materials',
  });

  // ─── Assignments ───
  const { data: assignments = [] } = useQuery({
    queryKey: ['student-assignments', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignments')
        .select('id, title, instructions, due_date, created_at')
        .eq('course_id', courseId!)
        .order('due_date', { ascending: true });
      return data || [];
    },
    enabled: !!courseId && activeTab === 'assignments',
  });

  // ─── My submissions ───
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ['student-submissions', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, assignment_id, status, submitted_at, feedback')
        .eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!courseId && !!user?.id && activeTab === 'assignments',
  });

  // ─── Exams ───
  const { data: exams = [] } = useQuery({
    queryKey: ['student-exams', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('teaching_exams')
        .select('id, title, duration_minutes, total_marks, pass_mark_percent, status, published_at')
        .eq('course_id', courseId!)
        .eq('status', 'published');
      return data || [];
    },
    enabled: !!courseId && activeTab === 'exams',
  });

  // ─── My exam results ───
  const { data: myExamResults = [] } = useQuery({
    queryKey: ['student-exam-results', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teaching_exam_submissions')
        .select('id, exam_id, total_score, total_possible, percentage, passed, status, submitted_at')
        .eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!courseId && !!user?.id && activeTab === 'exams',
  });

  // ─── Announcements ───
  const { data: announcements = [] } = useQuery({
    queryKey: ['student-announcements', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_notifications')
        .select('id, title, body, created_at')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!courseId,
  });

  const attendancePct = attendanceRecords.length > 0
    ? Math.round(attendanceRecords.filter(a => a.status === 'present').length / attendanceRecords.length * 100)
    : 0;

  const syllabusRows: Array<{ week: number; topic: string; objectives: string; contentTypes: string[] }> =
    syllabus?.rows
      ? (typeof syllabus.rows === 'string' ? JSON.parse(syllabus.rows) : syllabus.rows as any)
      : [];

  // ─── Class status ───
  const classStatus = myClass
    ? getClassStatus(myClass.schedule_days as string[], myClass.schedule_time as string, myClass.session_duration as number)
    : 'not_today';

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-dashboard')} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> My Dashboard
        </Button>
        {isLoading ? <Skeleton className="h-8 w-64" /> : (
          <div>
            <h1 className="text-xl font-bold text-foreground">{course?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {(course?.divisions as any)?.name}
              {course?.level && ` · ${course.level}`}
              {enrollment && ` · Enrolled ${format(new Date(enrollment.enrolled_at), 'MMM yyyy')}`}
            </p>
          </div>
        )}
      </div>

      {/* Next Class Card — Smart Join */}
      {myClass && (
        <Card className={cn(
          'border',
          classStatus === 'live' && 'border-emerald-500 bg-emerald-50/50',
          classStatus === 'upcoming' && 'border-blue-300 bg-blue-50/50',
          classStatus === 'not_today' && 'border-border',
          classStatus === 'ended' && 'border-border',
        )}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                classStatus === 'live' ? 'bg-emerald-100' : 'bg-primary/10',
              )}>
                <Video className={cn('h-5 w-5', classStatus === 'live' ? 'text-emerald-600' : 'text-primary')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{myClass.name}</p>
                  {classStatus === 'live' && <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">LIVE</Badge>}
                  {classStatus === 'upcoming' && <Badge variant="secondary" className="text-[10px]">Starting soon</Badge>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(myClass.schedule_days as string[])?.join(', ')} · {myClass.schedule_time} · {myClass.session_duration} min
                </p>
              </div>
            </div>
            {myClass.meeting_link && (classStatus === 'live' || classStatus === 'upcoming') ? (
              <Button size="sm" className={cn('w-full sm:w-auto', classStatus === 'live' && 'bg-emerald-600 hover:bg-emerald-700')}
                onClick={() => window.open(myClass.meeting_link as string, '_blank')}>
                <Video className="h-4 w-4 mr-1" /> Join Class
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {classStatus === 'ended' ? 'Class ended for today' : `Next: ${(myClass.schedule_days as string[])?.[0] || '—'}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto justify-start h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Schedule</TabsTrigger>
          <TabsTrigger value="materials" className="gap-1"><FileText className="h-3.5 w-3.5" /> Materials</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1"><ClipboardList className="h-3.5 w-3.5" /> Assignments</TabsTrigger>
          <TabsTrigger value="exams" className="gap-1"><GraduationCap className="h-3.5 w-3.5" /> Exams</TabsTrigger>
          <TabsTrigger value="chat" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{attendancePct}%</p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {mySubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length}/{assignments.length || '—'}
              </p>
              <p className="text-xs text-muted-foreground">Assignments</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {myExamResults.length}/{exams.length || '—'}
              </p>
              <p className="text-xs text-muted-foreground">Exams taken</p>
            </CardContent></Card>
          </div>

          {announcements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Recent announcements</h3>
              <div className="space-y-2">
                {announcements.slice(0, 3).map(a => (
                  <Card key={a.id}><CardContent className="p-3 flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.body?.slice(0, 100)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {a.created_at && formatDistanceToNow(new Date(a.created_at))} ago
                      </p>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            </div>
          )}

          {syllabusRows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Syllabus · {syllabusRows.length} weeks</h3>
              <div className="space-y-1.5">
                {syllabusRows.map((row, idx) => (
                  <Card key={idx}><CardContent className="p-3 flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                      {row.week}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{row.topic}</p>
                      <p className="text-xs text-muted-foreground">{row.objectives}</p>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── SCHEDULE ─── */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">My attendance</h3>
              <span className="text-sm font-bold text-foreground">{attendancePct}%</span>
            </div>
            <Progress value={attendancePct} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              {attendanceRecords.filter(a => a.status === 'present').length} present ·{' '}
              {attendanceRecords.filter(a => a.status === 'absent').length} absent
            </p>
          </CardContent></Card>

          <div className="space-y-1">
            {attendanceRecords.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                <span className="text-sm">{format(new Date(a.class_date), 'EEE, MMM d, yyyy')}</span>
                <Badge variant={a.status === 'present' ? 'default' : a.status === 'late' ? 'secondary' : 'destructive'} className="text-[10px]">
                  {a.status}
                </Badge>
              </div>
            ))}
            {attendanceRecords.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No attendance records yet</p>
            )}
          </div>
        </TabsContent>

        {/* ─── MATERIALS ─── */}
        <TabsContent value="materials" className="space-y-2 mt-4">
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No materials shared yet</p>
          ) : (
            materials.map(m => (
              <Card key={m.id}><CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.asset_type} · {format(new Date(m.created_at!), 'MMM d')}</p>
                  </div>
                </div>
                {m.content_url && (
                  <Button variant="ghost" size="sm" onClick={() => window.open(m.content_url!, '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </CardContent></Card>
            ))
          )}
        </TabsContent>

        {/* ─── ASSIGNMENTS ─── */}
        <TabsContent value="assignments" className="space-y-2 mt-4">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No assignments yet</p>
          ) : (
            assignments.map(a => {
              const submission = mySubmissions.find(s => s.assignment_id === a.id);
              const isPastDue = a.due_date && new Date(a.due_date) < new Date();
              return (
                <Card key={a.id}><CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.instructions?.slice(0, 120)}</p>
                      {a.due_date && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Due: {format(new Date(a.due_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    {submission ? (
                      <Badge variant={submission.status === 'graded' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {submission.status}
                      </Badge>
                    ) : isPastDue ? (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Past due</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">Pending</Badge>
                    )}
                  </div>
                  {submission?.feedback && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      Feedback: {submission.feedback}
                    </p>
                  )}
                </CardContent></Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── EXAMS ─── */}
        <TabsContent value="exams" className="space-y-2 mt-4">
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No exams published yet</p>
          ) : (
            exams.map(exam => {
              const result = myExamResults.find(r => r.exam_id === exam.id);
              return (
                <Card key={exam.id}><CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.duration_minutes} min · {exam.total_marks} marks · Pass: {exam.pass_mark_percent}%
                      </p>
                    </div>
                    {result ? (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{result.total_score}/{result.total_possible}</p>
                        <Badge variant={result.passed ? 'default' : 'destructive'} className="text-[10px]">
                          {result.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">Not taken</Badge>
                    )}
                  </div>
                </CardContent></Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── CHAT ─── */}
        <TabsContent value="chat" className="mt-4">
          <CourseDiscussionBoard courseId={courseId!} currentUserId={user?.id || ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
