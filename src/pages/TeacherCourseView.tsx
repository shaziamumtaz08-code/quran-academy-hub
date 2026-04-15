import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TeachTodayTab } from '@/components/courses/TeachTodayTab';
import { ClassChatTab } from '@/components/courses/ClassChatTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, Users, BookOpen, Calendar, Video, Sparkles,
  ClipboardCheck, FileText, GraduationCap, ExternalLink, Clock
} from 'lucide-react';

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

export default function TeacherCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('classes');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [attendanceState, setAttendanceState] = useState<Record<string, string>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  const { data: course } = useQuery({
    queryKey: ['teacher-course', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, description, division_id, divisions:divisions(name)')
        .eq('id', courseId!)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-my-classes', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_staff')
        .select(`
          id, staff_role,
          class:course_classes!inner(
            id, name, schedule_days, schedule_time, session_duration,
            meeting_link, max_seats, course_id,
            students:course_class_students(id, student_id)
          )
        `)
        .eq('user_id', user!.id)
        .eq('class.course_id', courseId!);
      return data || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  // Auto-select first class for attendance tab
  const firstClassId = (myClasses[0] as any)?.class?.id || null;
  const effectiveClassId = selectedClassId || firstClassId;

  const studentIds = [...new Set(
    myClasses.flatMap((mc: any) => (mc.class?.students || []).map((s: any) => s.student_id))
  )];

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ['teacher-class-students', studentIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const profileMap = new Map(studentProfiles.map(p => [p.id, p]));

  const { data: syllabus } = useQuery({
    queryKey: ['teacher-syllabus', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('syllabi')
        .select('id, rows, duration_weeks, sessions_week, status')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!courseId,
  });

  const { data: pendingSubmissions = [] } = useQuery({
    queryKey: ['teacher-pending-submissions', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, status, assignment_id, course_assignments!inner(course_id, title)')
        .eq('course_assignments.course_id', courseId!)
        .eq('status', 'submitted');
      return data || [];
    },
    enabled: !!courseId,
  });

  const totalStudents = myClasses.reduce((sum, c: any) => sum + ((c.class?.students as any[])?.length || 0), 0);

  // Determine if user is moderator-only (no teacher assignment in this course)
  const isModeratorOnly = myClasses.length > 0 && myClasses.every((mc: any) => mc.staff_role === 'moderator');
  const staffRoles = [...new Set(myClasses.map((mc: any) => mc.staff_role as string))];

  // ─── Save attendance ───
  const handleSaveAttendance = async (classId: string) => {
    const entries = Object.entries(attendanceState);
    if (!entries.length) { toast.error('Mark at least one student'); return; }

    setSavingAttendance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = entries.map(([studentId, status]) => ({
        student_id: studentId,
        teacher_id: user!.id,
        course_id: courseId!,
        class_date: today,
        class_time: new Date().toTimeString().slice(0, 5),
        status,
        duration_minutes: 30,
      }));

      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;

      toast.success(`Attendance saved for ${entries.length} students`);
      setAttendanceState({});
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // ─── Post-class handler ───
  const handlePostClass = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('attendance');
  };

  const quickActions = [
    // Teaching OS: teachers can create, moderators can only view
    ...(isModeratorOnly
      ? (syllabus ? [{
          icon: Sparkles,
          label: 'View Syllabus',
          sub: 'Read-only',
          color: 'text-amber-600',
          onClick: () => navigate(`/teaching-os/planner?syllabus_id=${syllabus.id}&course_id=${courseId}`),
        }] : [])
      : [{
          icon: Sparkles,
          label: 'Teaching OS',
          sub: syllabus ? 'Open planner' : 'Create syllabus',
          color: 'text-amber-600',
          onClick: () => syllabus
            ? navigate(`/teaching-os/planner?syllabus_id=${syllabus.id}&course_id=${courseId}`)
            : navigate(`/teaching-os?course_id=${courseId}`),
        }]
    ),
    {
      icon: ClipboardCheck,
      label: 'Attendance',
      sub: 'Mark today',
      color: 'text-emerald-600',
      onClick: () => setActiveTab('attendance'),
    },
    ...(!isModeratorOnly ? [{
      icon: GraduationCap,
      label: 'Exams',
      sub: 'Create & grade',
      color: 'text-violet-600',
      onClick: () => navigate(`/teaching-os/assessment?course_id=${courseId}`),
    }] : [{
      icon: GraduationCap,
      label: 'Exams',
      sub: 'View results',
      color: 'text-violet-600',
      onClick: () => navigate(`/teaching-os/assessment?course_id=${courseId}`),
    }]),
    {
      icon: FileText,
      label: 'Assignments',
      sub: pendingSubmissions.length > 0 ? `${pendingSubmissions.length} to review` : 'All caught up',
      color: 'text-blue-600',
      onClick: () => setActiveTab('assignments'),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-dashboard')} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> My Dashboard
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">{course?.name}</h1>
          {staffRoles.map(role => (
            <Badge key={role} variant={role === 'moderator' ? 'secondary' : 'default'} className="text-[10px] capitalize">
              {role}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {(course?.divisions as any)?.name}
          {course?.level && ` · ${course.level}`}
          {` · ${totalStudents} students in my classes`}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map(qa => (
          <Card key={qa.label} className="p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={qa.onClick}>
            <qa.icon className={`h-5 w-5 ${qa.color} mb-1.5`} />
            <p className="text-sm font-medium">{qa.label}</p>
            <p className="text-xs text-muted-foreground">{qa.sub}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="classes" className="gap-1"><Users className="h-3.5 w-3.5" /> My Classes</TabsTrigger>
          <TabsTrigger value="teach-today" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> Teach Today</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Attendance</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1"><FileText className="h-3.5 w-3.5" /> Assignments</TabsTrigger>
          <TabsTrigger value="class-chat" className="gap-1"><Video className="h-3.5 w-3.5" /> Class Chat</TabsTrigger>
          <TabsTrigger value="students" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Students</TabsTrigger>
        </TabsList>

        {/* ─── MY CLASSES ─── */}
        <TabsContent value="classes" className="space-y-3 mt-4">
          {myClasses.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              You are not assigned to any classes in this course yet.
            </CardContent></Card>
          ) : (
            myClasses.map((mc: any) => {
              const cls = mc.class;
              const students: any[] = cls?.students || [];
              const studentCount = students.length;
              const maxSeats = cls?.max_seats || 0;
              const capacityPct = maxSeats ? Math.round(studentCount / maxSeats * 100) : 0;
              const status = cls ? getClassStatus(cls.schedule_days as string[], cls.schedule_time as string, cls.session_duration as number) : 'not_today';

              return (
                <Card key={mc.id} className={cn(
                  status === 'live' && 'border-emerald-500 bg-emerald-50/50',
                  status === 'upcoming' && 'border-blue-300 bg-blue-50/50',
                )}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{cls?.name}</p>
                          <Badge variant="secondary" className="text-[10px]">{mc.staff_role}</Badge>
                          {status === 'live' && <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">LIVE</Badge>}
                          {status === 'upcoming' && <Badge variant="secondary" className="text-[10px]">Starting soon</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {(cls?.schedule_days as string[])?.join(', ')} · {cls?.schedule_time} · {cls?.session_duration} min
                        </p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        {cls?.meeting_link && (status === 'live' || status === 'upcoming') && (
                          <Button size="sm" className={cn('flex-1 sm:flex-none', status === 'live' && 'bg-emerald-600 hover:bg-emerald-700')}
                            onClick={() => window.open(cls.meeting_link, '_blank')}>
                            <Video className="h-4 w-4 mr-1" />
                            {status === 'live' ? 'Rejoin Class' : 'Start Class'}
                          </Button>
                        )}
                        {status === 'ended' && (
                          <Button size="sm" variant="outline" className="flex-1 sm:flex-none"
                            onClick={() => handlePostClass(cls.id)}>
                            <ClipboardCheck className="h-4 w-4 mr-1" /> Mark Attendance
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Capacity */}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{studentCount} students</span>
                        <span>{studentCount}/{maxSeats || '∞'}</span>
                      </div>
                      {maxSeats > 0 && (
                        <Progress
                          value={capacityPct}
                          className={`h-1.5 ${capacityPct > 90 ? '[&>div]:bg-destructive' : capacityPct > 70 ? '[&>div]:bg-amber-500' : ''}`}
                        />
                      )}
                    </div>

                    {/* Student badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {students.slice(0, 10).map((s: any) => {
                        const profile = profileMap.get(s.student_id);
                        return (
                          <Badge key={s.id} variant="outline" className="text-[10px] font-normal">
                            {profile?.full_name || 'Student'}
                          </Badge>
                        );
                      })}
                      {studentCount > 10 && (
                        <Badge variant="secondary" className="text-[10px]">+{studentCount - 10} more</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── TEACH TODAY ─── */}
        <TabsContent value="teach-today" className="mt-4">
          <TeachTodayTab courseId={courseId!} />
        </TabsContent>

        {/* ─── ATTENDANCE ─── */}
        <TabsContent value="attendance" className="space-y-4 mt-4">
          {/* Class selector */}
          {myClasses.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {myClasses.map((mc: any) => (
                <Button key={mc.id} size="sm"
                  variant={effectiveClassId === mc.class?.id ? 'default' : 'outline'}
                  onClick={() => { setSelectedClassId(mc.class?.id); setAttendanceState({}); }}>
                  {mc.class?.name}
                </Button>
              ))}
            </div>
          )}

          {effectiveClassId && (() => {
            const cls = myClasses.find((mc: any) => mc.class?.id === effectiveClassId) as any;
            const students: any[] = cls?.class?.students || [];

            return (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-sm">
                      {cls?.class?.name} · {format(new Date(), 'EEEE, MMM d')}
                    </h3>
                    <Button size="sm" onClick={() => handleSaveAttendance(effectiveClassId)} disabled={savingAttendance}>
                      {savingAttendance ? 'Saving...' : 'Save Attendance'}
                    </Button>
                  </div>

                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No students in this class</p>
                  ) : (
                    <div className="space-y-1">
                      {students.map((s: any) => {
                        const profile = profileMap.get(s.student_id);
                        const currentStatus = attendanceState[s.student_id] || '';
                        return (
                          <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                {(profile?.full_name || 'S').charAt(0)}
                              </div>
                              <p className="text-sm truncate">{profile?.full_name || 'Student'}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {(['present', 'absent', 'late'] as const).map(status => (
                                <Button key={status} size="sm"
                                  variant={currentStatus === status ? 'default' : 'outline'}
                                  className={cn(
                                    'text-xs px-2.5 h-8 min-w-[2rem]',
                                    currentStatus === status && status === 'present' && 'bg-emerald-600 hover:bg-emerald-700',
                                    currentStatus === status && status === 'absent' && 'bg-destructive hover:bg-destructive/90',
                                    currentStatus === status && status === 'late' && 'bg-amber-600 hover:bg-amber-700',
                                  )}
                                  onClick={() => setAttendanceState(prev => ({ ...prev, [s.student_id]: status }))}>
                                  {status === 'present' ? 'P' : status === 'absent' ? 'A' : 'L'}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ─── ASSIGNMENTS ─── */}
        <TabsContent value="assignments" className="space-y-3 mt-4">
          {pendingSubmissions.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3 text-sm text-amber-800">
                {pendingSubmissions.length} submission{pendingSubmissions.length > 1 ? 's' : ''} waiting for review
              </CardContent>
            </Card>
          )}
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Full assignment management coming soon.
          </CardContent></Card>
        </TabsContent>

        {/* ─── CLASS CHAT ─── */}
        <TabsContent value="class-chat" className="mt-4">
          <ClassChatTab courseId={courseId!} mode="teacher" />
        </TabsContent>

        {/* ─── STUDENTS ─── */}
        <TabsContent value="students" className="space-y-4 mt-4">
          {myClasses.map((mc: any) => {
            const cls = mc.class;
            const students: any[] = cls?.students || [];
            return (
              <div key={mc.id}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">{cls?.name}</p>
                <div className="space-y-1">
                  {students.map((s: any) => {
                    const profile = profileMap.get(s.student_id);
                    return (
                      <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {(profile?.full_name || 'S').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No students assigned</p>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
